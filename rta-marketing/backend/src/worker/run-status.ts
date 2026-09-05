import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { scrapeRuns, sourceRuns } from "../db/schema.js";

export async function recomputeRun(runId: string): Promise<void> {
  const [parent] = await db
    .select({ status: scrapeRuns.status })
    .from(scrapeRuns)
    .where(eq(scrapeRuns.id, runId))
    .limit(1);
  if (!parent) return;

  const rows = await db
    .select({
      status: sourceRuns.status,
      discovered: sourceRuns.discoveredCount,
      inserted: sourceRuns.insertedCount,
      updated: sourceRuns.updatedCount,
      rejected: sourceRuns.rejectedCount,
    })
    .from(sourceRuns)
    .where(eq(sourceRuns.runId, runId));

  const completed = rows.filter((row) => row.status === "completed").length;
  const failed = rows.filter((row) =>
    ["failed", "dead_letter"].includes(row.status),
  ).length;
  const cancelled = rows.filter((row) => row.status === "cancelled").length;
  const terminal = completed + failed + cancelled === rows.length;
  const status = parent.status === "cancelled"
    ? "cancelled"
    : terminal
    ? failed > 0
      ? completed > 0
        ? "partial"
        : "failed"
      : cancelled === rows.length
        ? "cancelled"
        : "completed"
    : "running";

  await db
    .update(scrapeRuns)
    .set({
      status,
      completedSourceCount: completed,
      failedSourceCount: failed,
      discoveredCount: rows.reduce((sum, row) => sum + row.discovered, 0),
      insertedCount: rows.reduce((sum, row) => sum + row.inserted, 0),
      updatedCount: rows.reduce((sum, row) => sum + row.updated, 0),
      rejectedCount: rows.reduce((sum, row) => sum + row.rejected, 0),
      startedAt: sql`coalesce(${scrapeRuns.startedAt}, now())`,
      finishedAt: terminal ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(scrapeRuns.id, runId));
}

export async function markJobsDeadLetter(
  sourceRunIds: string[],
): Promise<void> {
  if (sourceRunIds.length === 0) return;

  const affectedRuns = await db
    .select({ runId: sourceRuns.runId })
    .from(sourceRuns)
    .where(inArray(sourceRuns.id, sourceRunIds));

  await db
    .update(sourceRuns)
    .set({
      status: "dead_letter",
      errorCode: "SQS_MAX_RECEIVES_EXCEEDED",
      errorMessage:
        "The source job exhausted its queue delivery attempts and was moved to the dead-letter queue",
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(sourceRuns.id, sourceRunIds));

  for (const runId of new Set(affectedRuns.map((row) => row.runId))) {
    await recomputeRun(runId);
  }
}
