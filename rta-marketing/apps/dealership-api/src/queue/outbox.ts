import { env } from "../config/env.js";
import { scrapeJobSchema, type ScrapeJob } from "../contracts/scrape.js";
import { pool } from "../db/client.js";
import { publishScrapeJob } from "./sqs.js";
import { outboxRetryDelaySeconds } from "./outbox-policy.js";
import { logger } from "../lib/logger.js";

interface ClaimedRow {
  id: string;
  payload: unknown;
  attempt_count: number;
}

let dispatching = false;

function safeMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "Queue publication failed")
    .replace(/https?:\/\/\S+/g, "[redacted URL]")
    .slice(0, 500);
}

async function claimRows(limit: number): Promise<ClaimedRow[]> {
  const result = await pool.query<ClaimedRow>(
    `update job_outbox
       set status = 'processing', locked_at = now(), attempt_count = attempt_count + 1, updated_at = now()
     where id in (
       select id from job_outbox
       where (status = 'pending' and available_at <= now())
          or (status = 'processing' and locked_at < now() - interval '2 minutes')
       order by available_at, created_at
       for update skip locked
       limit $1
     )
     returning id, payload, attempt_count`,
    [limit],
  );
  return result.rows;
}

async function publishRow(row: ClaimedRow): Promise<void> {
  try {
    const job: ScrapeJob = scrapeJobSchema.parse(row.payload);
    await publishScrapeJob(job);
    await pool.query(
      `update job_outbox set status = 'published', published_at = now(), locked_at = null,
       last_error = null, updated_at = now() where id = $1`,
      [row.id],
    );
  } catch (error) {
    const delaySeconds = outboxRetryDelaySeconds(row.attempt_count);
    await pool.query(
      `update job_outbox set status = 'pending', available_at = now() + ($2 * interval '1 second'),
       locked_at = null, last_error = $3, updated_at = now() where id = $1`,
      [row.id, delaySeconds, safeMessage(error)],
    );
  }
}

export async function dispatchOutbox(): Promise<number> {
  if (!env.SQS_INTEGRATION_ENABLED) return 0;
  if (dispatching) return 0;
  dispatching = true;
  try {
    const rows = await claimRows(env.QUEUE_OUTBOX_BATCH_SIZE);
    await Promise.all(rows.map(publishRow));
    return rows.length;
  } finally {
    dispatching = false;
  }
}

export function startOutboxDispatcher(): () => void {
  void dispatchOutbox().catch((error) => logger.error({ err: error }, "Initial outbox dispatch failed"));
  const timer = setInterval(() => void dispatchOutbox().catch((error) => logger.error({ err: error }, "Outbox dispatch failed")), env.QUEUE_OUTBOX_POLL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
