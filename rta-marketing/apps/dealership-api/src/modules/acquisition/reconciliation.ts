import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { scrapeActorRuns } from "../../db/schema.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { incrementMetric } from "../../infra/metrics.js";
import { bumpCacheVersions, cacheNamespacesForActorCompletion } from "../../infra/cache.js";
import { ApifyClientError, mapApifyStatus, requireApifyClient, type ApifyClient, type ApifyRun } from "./apify-client.js";
import type { ApifySiteKey } from "./source-mapping.js";

export const terminalActorStatuses = ["completed", "failed", "cancelled"] as const;
export type ActorRunRow = typeof scrapeActorRuns.$inferSelect;

function isTerminalActorStatus(status: string): status is (typeof terminalActorStatuses)[number] {
  return (terminalActorStatuses as readonly string[]).includes(status);
}

export interface ActorRunRepository {
  findStuck(cutoff: Date, limit: number): Promise<ActorRunRow[]>;
  update(id: string, values: Partial<typeof scrapeActorRuns.$inferInsert>): Promise<ActorRunRow | undefined>;
}

const databaseRepository: ActorRunRepository = {
  findStuck: (cutoff, limit) => db.select().from(scrapeActorRuns)
    .where(and(inArray(scrapeActorRuns.status, ["queued", "scraping"]), lt(scrapeActorRuns.updatedAt, cutoff)))
    .orderBy(desc(scrapeActorRuns.updatedAt))
    .limit(limit),
  update: async (id, values) => {
    const [row] = await db.update(scrapeActorRuns).set(values).where(eq(scrapeActorRuns.id, id)).returning();
    return row;
  },
};

function safeRunError(run: ApifyRun): string | null {
  return mapApifyStatus(run.status) === "failed" ? "The Apify Actor run failed." : null;
}

export function isActorRunStale(row: Pick<ActorRunRow, "status" | "updatedAt">, now = Date.now(), staleMs = env.APIFY_RECONCILIATION_STALE_MS): boolean {
  return !isTerminalActorStatus(row.status)
    && now - row.updatedAt.getTime() >= staleMs;
}

export async function reconcileActorRun(
  row: ActorRunRow,
  options: { client?: ApifyClient; update?: ActorRunRepository["update"] } = {},
): Promise<ActorRunRow> {
  if (isTerminalActorStatus(row.status)) return row;
  const siteKey = row.siteKey as ApifySiteKey;
  const client = options.client ?? requireApifyClient();
  const remote = await client.getRun(row.apifyRunId, siteKey);
  const status = mapApifyStatus(remote.status);
  const finishedAt = isTerminalActorStatus(status) ? (remote.finishedAt ? new Date(remote.finishedAt) : new Date()) : null;
  let output: Awaited<ReturnType<ApifyClient["getOutput"]>> | undefined;
  if (status === "completed") {
    try {
      output = await client.getOutput(remote, siteKey);
    } catch (error) {
      logger.warn({ siteKey, runId: row.apifyRunId, errorKind: error instanceof ApifyClientError ? error.kind : "unknown" }, "Apify run completed but output metadata was unavailable");
    }
  }
  const startedAt = remote.startedAt ? new Date(remote.startedAt) : row.startedAt;
  const durationMs = output?.durationMs ?? (finishedAt && startedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : row.durationMs);
  if (status === row.status && !output) return row;
  const update = options.update ?? databaseRepository.update;
  const updated = await update(row.id, {
    status,
    foundCount: output?.foundCount ?? row.foundCount,
    durationMs,
    timings: output?.timings ?? row.timings,
    startedAt,
    finishedAt,
    lastError: safeRunError(remote),
    updatedAt: new Date(),
  });
  if (!updated) throw new AppError(500, "APIFY_RECONCILIATION_FAILED", "Apify run reconciliation failed");
  if (status === "completed") incrementMetric("apify_runs_succeeded");
  if (status === "failed" || status === "cancelled") incrementMetric("apify_runs_failed");
  const invalidatedNamespaces = cacheNamespacesForActorCompletion(row.status, status);
  if (invalidatedNamespaces.length) await bumpCacheVersions(invalidatedNamespaces);
  return updated;
}

export interface ReconciliationResult {
  examined: number;
  reconciled: number;
  stillActive: number;
  failed: number;
  errors: Array<{ siteKey: string; kind: string }>;
}

export async function reconcileStuckApifyRuns(options: {
  repository?: ActorRunRepository;
  client?: ApifyClient;
  now?: number;
  staleMs?: number;
  batchSize?: number;
} = {}): Promise<ReconciliationResult> {
  const repository = options.repository ?? databaseRepository;
  const now = options.now ?? Date.now();
  const staleMs = options.staleMs ?? env.APIFY_RECONCILIATION_STALE_MS;
  const rows = await repository.findStuck(new Date(now - staleMs), options.batchSize ?? env.APIFY_RECONCILIATION_BATCH_SIZE);
  const result: ReconciliationResult = { examined: rows.length, reconciled: 0, stillActive: 0, failed: 0, errors: [] };
  for (const row of rows) {
    try {
      const reconcileOptions: { update: ActorRunRepository["update"]; client?: ApifyClient } = { update: repository.update };
      if (options.client) reconcileOptions.client = options.client;
      const updated = await reconcileActorRun(row, reconcileOptions);
      if (isTerminalActorStatus(updated.status)) result.reconciled += 1;
      else result.stillActive += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({ siteKey: row.siteKey, kind: error instanceof ApifyClientError ? error.kind : "unknown" });
    }
  }
  return result;
}
