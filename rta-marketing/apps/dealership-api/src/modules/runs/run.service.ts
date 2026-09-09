import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { jobOutbox, scrapeRuns, sourceRuns, sources } from "../../db/schema.js";
import { scrapeFiltersSchema, type CreateScrapeRunInput, type ScrapeJob, type SourceKey } from "../../contracts/scrape.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { dispatchOutbox } from "../../queue/outbox.js";

const defaultSources: SourceKey[] = [
  "autotrader",
  "autoplanet",
  "humberview",
  "yorkdalevw",
];

export interface CreatedRun {
  id: string;
  status: string;
  reused: boolean;
}

export async function createScrapeRun(
  input: CreateScrapeRunInput,
  idempotencyKey: string,
  userId?: string,
): Promise<CreatedRun> {
  const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const selectedKeys = input.sources ?? defaultSources;
  const selectedSources = await db
    .select({ id: sources.id, key: sources.key, enabled: sources.enabled, liveEnabled: sources.liveEnabled })
    .from(sources)
    .where(inArray(sources.key, selectedKeys));

  if (selectedSources.length !== selectedKeys.length) {
    throw new AppError(400, "INVALID_SOURCE", "One or more requested sources are unavailable");
  }

  const disabled = selectedSources.find(
    (source) => !source.enabled || (input.mode === "live" && !source.liveEnabled),
  );
  if (disabled) {
    throw new AppError(409, "SOURCE_DISABLED", `${disabled.key} is not enabled for this mode`);
  }

  const result = await db.transaction(async (transaction) => {
    const inserted = await transaction
      .insert(scrapeRuns)
      .values({
        requestedByUserId: userId ?? null,
        idempotencyKey,
        requestHash,
        mode: input.mode,
        filters: input.filters,
        sourceCount: selectedSources.length,
      })
      .onConflictDoNothing({ target: scrapeRuns.idempotencyKey })
      .returning({ id: scrapeRuns.id, status: scrapeRuns.status });

    const newRun = inserted[0];
    if (!newRun) {
      const existing = await transaction
        .select({
          id: scrapeRuns.id,
          status: scrapeRuns.status,
          requestedByUserId: scrapeRuns.requestedByUserId,
          requestHash: scrapeRuns.requestHash,
        })
        .from(scrapeRuns)
        .where(eq(scrapeRuns.idempotencyKey, idempotencyKey))
        .limit(1);
      const reused = existing[0];
      if (!reused) throw new Error("Idempotent run lookup failed");
      if (reused.requestedByUserId !== userId || reused.requestHash !== requestHash) {
        throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was used for a different scrape request");
      }
      return { run: reused, reused: true };
    }

    const sourceRunRows = await transaction
      .insert(sourceRuns)
      .values(selectedSources.map((source) => ({ runId: newRun.id, sourceId: source.id })))
      .returning({ id: sourceRuns.id, sourceId: sourceRuns.sourceId });
    const keysById = new Map(selectedSources.map((source) => [source.id, source.key as SourceKey]));
    const jobs: ScrapeJob[] = sourceRunRows.map((sourceRun) => ({
      version: 1,
      jobId: randomUUID(),
      runId: newRun.id,
      sourceRunId: sourceRun.id,
      sourceId: keysById.get(sourceRun.sourceId)!,
      mode: input.mode,
      filters: input.filters,
    }));
    await transaction.insert(jobOutbox).values(jobs.map((job) => ({ sourceRunId: job.sourceRunId, payload: job })));
    return { run: newRun, reused: false };
  });

  if (!result.reused && env.SQS_INTEGRATION_ENABLED) {
    await dispatchOutbox();
  }

  return { id: result.run.id, status: result.run.status, reused: result.reused };
}

export async function replaySourceRun(runId: string, sourceRunId: string): Promise<void> {
  const [row] = await db
    .select({
      sourceRunId: sourceRuns.id,
      status: sourceRuns.status,
      source: sources.key,
      mode: scrapeRuns.mode,
      filters: scrapeRuns.filters,
    })
    .from(sourceRuns)
    .innerJoin(scrapeRuns, eq(sourceRuns.runId, scrapeRuns.id))
    .innerJoin(sources, eq(sourceRuns.sourceId, sources.id))
    .where(and(eq(sourceRuns.id, sourceRunId), eq(sourceRuns.runId, runId)))
    .limit(1);
  if (!row) throw new AppError(404, "SOURCE_RUN_NOT_FOUND", "Source run was not found");
  if (row.status !== "failed" && row.status !== "dead_letter") {
    throw new AppError(409, "SOURCE_RUN_NOT_REPLAYABLE", "Only failed source runs can be replayed");
  }

  const job: ScrapeJob = {
    version: 1,
    jobId: randomUUID(),
    runId,
    sourceRunId,
    sourceId: row.source as SourceKey,
    mode: row.mode,
    filters: scrapeFiltersSchema.parse(row.filters),
  };
  await db.transaction(async (transaction) => {
    await transaction
      .update(sourceRuns)
      .set({ status: "queued", progressPercent: 0, errorCode: null, errorMessage: null, finishedAt: null, updatedAt: new Date() })
      .where(eq(sourceRuns.id, sourceRunId));
    await transaction
      .update(scrapeRuns)
      .set({ status: "running", finishedAt: null, updatedAt: new Date() })
      .where(eq(scrapeRuns.id, runId));
    await transaction
      .insert(jobOutbox)
      .values({ sourceRunId, payload: job })
      .onConflictDoUpdate({
        target: jobOutbox.sourceRunId,
        set: { payload: job, status: "pending", availableAt: new Date(), lockedAt: null, publishedAt: null, lastError: null, updatedAt: new Date() },
      });
  });
  await dispatchOutbox();
}

export async function getScrapeRun(id: string) {
  const rows = await db
    .select({
      id: scrapeRuns.id,
      mode: scrapeRuns.mode,
      status: scrapeRuns.status,
      filters: scrapeRuns.filters,
      sourceCount: scrapeRuns.sourceCount,
      completedSourceCount: scrapeRuns.completedSourceCount,
      failedSourceCount: scrapeRuns.failedSourceCount,
      discoveredCount: scrapeRuns.discoveredCount,
      insertedCount: scrapeRuns.insertedCount,
      updatedCount: scrapeRuns.updatedCount,
      rejectedCount: scrapeRuns.rejectedCount,
      startedAt: scrapeRuns.startedAt,
      finishedAt: scrapeRuns.finishedAt,
      createdAt: scrapeRuns.createdAt,
    })
    .from(scrapeRuns)
    .where(eq(scrapeRuns.id, id))
    .limit(1);

  const run = rows[0];
  if (!run) throw new AppError(404, "RUN_NOT_FOUND", "Scrape run was not found");

  const children = await db
    .select({
      id: sourceRuns.id,
      source: sources.key,
      sourceName: sources.name,
      status: sourceRuns.status,
      attemptCount: sourceRuns.attemptCount,
      progressPercent: sourceRuns.progressPercent,
      discoveredCount: sourceRuns.discoveredCount,
      validCount: sourceRuns.validCount,
      insertedCount: sourceRuns.insertedCount,
      updatedCount: sourceRuns.updatedCount,
      rejectedCount: sourceRuns.rejectedCount,
      errorCode: sourceRuns.errorCode,
      errorMessage: sourceRuns.errorMessage,
      startedAt: sourceRuns.startedAt,
      finishedAt: sourceRuns.finishedAt,
    })
    .from(sourceRuns)
    .innerJoin(sources, eq(sourceRuns.sourceId, sources.id))
    .where(eq(sourceRuns.runId, id));

  return { ...run, sources: children };
}

export async function listScrapeRuns(limit: number) {
  return db
    .select()
    .from(scrapeRuns)
    .orderBy(desc(scrapeRuns.createdAt))
    .limit(limit);
}

export async function cancelScrapeRun(id: string): Promise<void> {
  const changed = await db.transaction(async (transaction) => {
    const updated = await transaction
      .update(scrapeRuns)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(and(eq(scrapeRuns.id, id), inArray(scrapeRuns.status, ["queued", "running", "partial"])))
      .returning({ id: scrapeRuns.id });

    if (updated.length > 0) {
      await transaction
        .update(sourceRuns)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(sourceRuns.runId, id), inArray(sourceRuns.status, ["queued", "running"])));
    }
    return updated.length;
  });

  if (changed === 0) {
    const existing = await db.select({ id: scrapeRuns.id }).from(scrapeRuns).where(eq(scrapeRuns.id, id));
    if (existing.length === 0) throw new AppError(404, "RUN_NOT_FOUND", "Scrape run was not found");
    throw new AppError(409, "RUN_NOT_CANCELLABLE", "This scrape run can no longer be cancelled");
  }
}

export async function getRunSummary() {
  const [row] = await db
    .select({
      totalRuns: sql<number>`count(*)::int`,
      successfulRuns: sql<number>`count(*) filter (where ${scrapeRuns.status} = 'completed')::int`,
      activeRuns: sql<number>`count(*) filter (where ${scrapeRuns.status} in ('queued', 'running', 'partial'))::int`,
      failedRuns: sql<number>`count(*) filter (where ${scrapeRuns.status} = 'failed')::int`,
    })
    .from(scrapeRuns);
  return row ?? { totalRuns: 0, successfulRuns: 0, activeRuns: 0, failedRuns: 0 };
}
