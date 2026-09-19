import { and, desc, gte, inArray, sql } from "drizzle-orm";
import { db, pool, verifyDatabaseConnection } from "../../db/client.js";
import { scrapeActorRuns } from "../../db/schema.js";
import { metricsSummary } from "../../infra/metrics.js";
import { redisHealth } from "../../infra/redis.js";
import { APPROVED_APIFY_SITE_KEYS, type ApifySiteKey } from "../acquisition/source-mapping.js";

const sourceNames: Record<ApifySiteKey, string> = {
  "romans-international": "Romans International",
  "tom-hartley": "Tom Hartley",
  "redline-specialist-cars": "Redline Specialist Cars",
};

export type SourceHealthStatus = "healthy" | "degraded" | "failing" | "unknown";

interface ActorHealthRow {
  siteKey: string;
  status: string;
  foundCount: number | null;
  recordsDiscovered?: number | null;
  recordsAccepted?: number | null;
  recordsRejected?: number | null;
  parserVersion?: string | null;
  durationMs: number | null;
  finishedAt: Date | null;
  createdAt: Date;
}

export interface SourceHealthSummary {
  source: ApifySiteKey;
  name: string;
  status: SourceHealthStatus;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  lastDurationMs: number | null;
  recordsDiscovered: number | null;
  recordsAccepted: number | null;
  recordsRejected: number | null;
  parserVersion: string | null;
}

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function deriveSourceHealth(rows: readonly ActorHealthRow[], now = Date.now()): SourceHealthStatus {
  const latest = rows[0];
  if (!latest) return "unknown";
  const consecutiveFailures = rows.findIndex((row) => row.status === "completed");
  if (latest.status === "failed" && (consecutiveFailures === -1 || consecutiveFailures >= 3)) return "failing";
  if (latest.status !== "completed" || (latest.finishedAt && now - latest.finishedAt.getTime() > 24 * 60 * 60 * 1_000)) return "degraded";
  return "healthy";
}

export function buildSourceHealth(rows: readonly ActorHealthRow[], now = Date.now()): SourceHealthSummary[] {
  return APPROVED_APIFY_SITE_KEYS.map((source) => {
    const sourceRows = rows.filter((row) => row.siteKey === source).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    const latest = sourceRows[0];
    const latestSuccess = sourceRows.find((row) => row.status === "completed");
    const latestFailure = sourceRows.find((row) => row.status === "failed");
    const consecutiveFailures = sourceRows.findIndex((row) => row.status === "completed");
    return {
      source,
      name: sourceNames[source],
      status: deriveSourceHealth(sourceRows, now),
      lastSuccessAt: toIso(latestSuccess?.finishedAt ?? null),
      lastFailureAt: toIso(latestFailure?.finishedAt ?? null),
      consecutiveFailures: consecutiveFailures === -1 ? sourceRows.filter((row) => row.status === "failed").length : consecutiveFailures,
      lastDurationMs: latest?.durationMs ?? null,
      // The current Actor output contract exposes accepted/found records only.
      // Unknown values remain null rather than being inferred as zero.
      recordsDiscovered: latest?.recordsDiscovered ?? null,
      recordsAccepted: latest?.recordsAccepted ?? latest?.foundCount ?? null,
      recordsRejected: latest?.recordsRejected ?? null,
      parserVersion: latest?.parserVersion ?? null,
    };
  });
}

async function actorRowsSince(since: Date): Promise<ActorHealthRow[]> {
  return db.select({
    siteKey: scrapeActorRuns.siteKey,
    status: scrapeActorRuns.status,
    foundCount: scrapeActorRuns.foundCount,
    recordsDiscovered: scrapeActorRuns.recordsDiscovered,
    recordsAccepted: scrapeActorRuns.recordsAccepted,
    recordsRejected: scrapeActorRuns.recordsRejected,
    parserVersion: scrapeActorRuns.parserVersion,
    durationMs: scrapeActorRuns.durationMs,
    finishedAt: scrapeActorRuns.finishedAt,
    createdAt: scrapeActorRuns.createdAt,
  }).from(scrapeActorRuns)
    .where(and(gte(scrapeActorRuns.createdAt, since), inArray(scrapeActorRuns.siteKey, [...APPROVED_APIFY_SITE_KEYS])))
    .orderBy(desc(scrapeActorRuns.createdAt));
}

export async function getSourceHealth(now = Date.now()): Promise<SourceHealthSummary[]> {
  return buildSourceHealth(await actorRowsSince(new Date(now - 90 * 24 * 60 * 60 * 1_000)), now);
}

export async function getApifyStats24h(now = Date.now()) {
  const since = new Date(now - 24 * 60 * 60 * 1_000);
  const [row] = await db.select({
    runs24h: sql<number>`count(*)::int`,
    successful: sql<number>`count(*) filter (where ${scrapeActorRuns.status} = 'completed')::int`,
    failed: sql<number>`count(*) filter (where ${scrapeActorRuns.status} = 'failed')::int`,
    averageDurationMs: sql<number | null>`round(avg(${scrapeActorRuns.durationMs}))::int`,
  }).from(scrapeActorRuns)
    .where(and(gte(scrapeActorRuns.createdAt, since), inArray(scrapeActorRuns.siteKey, [...APPROVED_APIFY_SITE_KEYS])));
  return row ?? { runs24h: 0, successful: 0, failed: 0, averageDurationMs: null };
}

export function deriveOperationalStatus(databaseReachable: boolean, redis: { configured: boolean; reachable: boolean }): "healthy" | "degraded" | "unavailable" {
  if (!databaseReachable) return "unavailable";
  if (redis.configured && !redis.reachable) return "degraded";
  return "healthy";
}

export async function collectOperationalHealth() {
  let database: { reachable: boolean; latencyMs: number | null };
  const databaseStarted = Date.now();
  try {
    await verifyDatabaseConnection();
    database = { reachable: true, latencyMs: Date.now() - databaseStarted };
  } catch {
    database = { reachable: false, latencyMs: null };
  }
  const redis = await redisHealth();
  const apify = await getApifyStats24h();
  return {
    status: deriveOperationalStatus(database.reachable, redis),
    database,
    redis: { ...redis, cacheHitRate: metricsSummary().redis.cacheHitRate },
    apify,
    ai: {
      requests24h: metricsSummary().ai.requests,
      providerFailures: metricsSummary().ai.providerFailures,
      fallbacks: metricsSummary().ai.fallbacks,
    },
  };
}

export async function collectMetricsSummary() {
  const [apify, sourceHealth] = await Promise.all([getApifyStats24h(), getSourceHealth()]);
  return { ...metricsSummary(), apify24h: apify, sourceHealth };
}

export { pool };
