import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { env } from "../config/env.js";
import type { ScrapeJob } from "../contracts/scrape.js";

const client = new SQSClient({ region: env.AWS_REGION });

export async function publishScrapeJob(job: ScrapeJob): Promise<string> {
  const response = await client.send(
    new SendMessageCommand({
      QueueUrl: env.SQS_SCRAPE_QUEUE_URL,
      MessageBody: JSON.stringify(job),
      MessageAttributes: {
        eventType: { DataType: "String", StringValue: "scrape.source.requested" },
        schemaVersion: { DataType: "Number", StringValue: String(job.version) },
        runMode: { DataType: "String", StringValue: job.mode },
      },
    }),
  );

  if (!response.MessageId) {
    throw new Error("SQS accepted the request without returning a message ID");
  }

  return response.MessageId;
}

export function closeQueueClient(): void {
  client.destroy();
}
