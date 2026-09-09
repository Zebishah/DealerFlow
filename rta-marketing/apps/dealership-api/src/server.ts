import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/client.js";
import { closeQueueClient } from "./queue/sqs.js";
import { startOutboxDispatcher } from "./queue/outbox.js";
import { logger } from "./lib/logger.js";

const server = createServer(createApp());
const stopOutboxDispatcher = startOutboxDispatcher();

server.listen(env.PORT, env.HOST, () => {
  logger.info({ host: env.HOST, port: env.PORT }, "RTA API listening");
});

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "Shutdown requested");
  stopOutboxDispatcher();
  setTimeout(() => process.exit(1), 30_000).unref();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  closeQueueClient();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
