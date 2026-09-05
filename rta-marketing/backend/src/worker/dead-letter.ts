import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { scrapeJobSchema } from "../contracts/scrape.js";
import { logger } from "../lib/logger.js";
import { markJobsDeadLetter } from "./processor.js";

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      const job = scrapeJobSchema.parse(JSON.parse(record.body) as unknown);
      await markJobsDeadLetter([job.sourceRunId]);
      logger.error(
        {
          messageId: record.messageId,
          runId: job.runId,
          sourceRunId: job.sourceRunId,
          source: job.sourceId,
        },
        "Scrape source job reconciled from dead-letter queue",
      );
    } catch (error) {
      logger.error(
        { err: error, messageId: record.messageId },
        "Dead-letter record reconciliation failed",
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}
