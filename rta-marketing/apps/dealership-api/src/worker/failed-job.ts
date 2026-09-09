import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { workerEnv } from "../config/worker-env.js";
import type { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const client = new SQSClient({ region: workerEnv.AWS_REGION });

export async function forwardPermanentFailure(body: string, error: AppError): Promise<void> {
  if (!workerEnv.SQS_SCRAPE_DLQ_URL) {
    throw new Error("SQS_SCRAPE_DLQ_URL is required to acknowledge a permanent failure safely");
  }
  const result = await client.send(new SendMessageCommand({
    QueueUrl: workerEnv.SQS_SCRAPE_DLQ_URL,
    MessageBody: body,
    MessageAttributes: {
      failureCode: { DataType: "String", StringValue: error.code },
      failureDisposition: { DataType: "String", StringValue: "permanent" },
    },
  }));
  if (!result.MessageId) throw new Error("DLQ publication returned no message ID");
  logger.warn({ errorCode: error.code, dlqMessageId: result.MessageId }, "Permanent scrape failure forwarded to DLQ; original delivery acknowledged");
}
