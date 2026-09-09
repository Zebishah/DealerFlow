import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { logger } from "../lib/logger.js";
import { processScrapeJob } from "./processor.js";
import { deliverScrapeMessage } from "./failure-policy.js";
import { forwardPermanentFailure } from "./failed-job.js";

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    try {
      await deliverScrapeMessage(record.body, processScrapeJob, forwardPermanentFailure);
    } catch (error) {
      logger.error(
        { err: error, messageId: record.messageId },
        "SQS scrape record failed",
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
