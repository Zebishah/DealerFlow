import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { processScrapeJob } from "./processor.js";

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];
  for (const record of event.Records) {
    try {
      await processScrapeJob(JSON.parse(record.body) as unknown);
    } catch (error) {
      console.error("SQS scrape record failed", { messageId: record.messageId, error });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
