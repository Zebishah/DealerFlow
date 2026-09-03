import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDatabase } from "./db/client.js";
import { closeQueueClient } from "./queue/sqs.js";

const server = createServer(createApp());

server.listen(env.PORT, env.HOST, () => {
  console.log(`RTA API listening on http://${env.HOST}:${env.PORT}`);
});

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`${signal} received; shutting down`);
  setTimeout(() => process.exit(1), 30_000).unref();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  closeQueueClient();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
