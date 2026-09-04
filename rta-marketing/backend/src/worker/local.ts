import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { workerEnv } from "../config/worker-env.js";
import { pool } from "../db/client.js";
import { processScrapeJob } from "./processor.js";
import { logger } from "../lib/logger.js";

if (!workerEnv.SQS_SCRAPE_QUEUE_URL) {
  throw new Error("SQS_SCRAPE_QUEUE_URL is required for the local worker");
}

const queueUrl = workerEnv.SQS_SCRAPE_QUEUE_URL;
const client = new SQSClient({ region: workerEnv.AWS_REGION });
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function consumeOnce(): Promise<number> {
  const response = await client.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: workerEnv.SQS_MAX_MESSAGES,
    WaitTimeSeconds: workerEnv.SQS_WAIT_TIME_SECONDS,
    VisibilityTimeout: workerEnv.SQS_VISIBILITY_TIMEOUT_SECONDS,
    MessageSystemAttributeNames: ["ApproximateReceiveCount"],
  }));

  for (const message of response.Messages ?? []) {
    if (!message.Body || !message.ReceiptHandle) continue;
    const receiptHandle = message.ReceiptHandle;
    const heartbeat = setInterval(() => {
      void client.send(new ChangeMessageVisibilityCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
        VisibilityTimeout: workerEnv.SQS_VISIBILITY_TIMEOUT_SECONDS,
      }));
    }, Math.max(30_000, (workerEnv.SQS_VISIBILITY_TIMEOUT_SECONDS * 1000) / 2));
    heartbeat.unref();

    try {
      await processScrapeJob(JSON.parse(message.Body) as unknown);
      await client.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: receiptHandle }));
    } catch (error) {
      logger.error({ err: error, messageId: message.MessageId }, "Local SQS job failed and will be retried");
    } finally {
      clearInterval(heartbeat);
    }
  }
  return response.Messages?.length ?? 0;
}

async function consumeLoop(runOnce: boolean): Promise<void> {
  do {
    await consumeOnce();
  } while (!runOnce && !stopping);
}

async function main(): Promise<void> {
  const runOnce = process.argv.includes("--once");
  await Promise.all(Array.from({ length: workerEnv.WORKER_CONCURRENCY }, () => consumeLoop(runOnce)));
  client.destroy();
  await pool.end();
}

void main().catch(async (error) => {
  logger.fatal({ err: error }, "Local worker stopped unexpectedly");
  await pool.end();
  process.exitCode = 1;
});
