import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { incrementMetric } from "./metrics.js";

const REDIS_CONNECT_TIMEOUT_MS = 3_000;
const REDIS_COMMAND_TIMEOUT_MS = 2_500;
let client: Redis | undefined;
let lastConnectionWarningAt = 0;

function connectionWarning(error: unknown): void {
  const now = Date.now();
  if (now - lastConnectionWarningAt < 30_000) return;
  lastConnectionWarningAt = now;
  incrementMetric("redis_failures");
  const candidate = error as { code?: unknown };
  logger.warn({ errorCode: typeof candidate?.code === "string" ? candidate.code : "unavailable" }, "Redis connection is unavailable");
}

export function isRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL);
}

export function getRedisClient(): Redis | undefined {
  if (!env.REDIS_URL) return undefined;
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
      retryStrategy: (attempt) => Math.min(attempt * 250, 1_500),
    });
    client.on("error", connectionWarning);
  }
  return client;
}

function waitUntilReady(redis: Redis): Promise<void> {
  if (redis.status === "ready") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error("Redis readiness timed out")), REDIS_CONNECT_TIMEOUT_MS);
    const onReady = () => finish();
    const onError = (error: Error) => finish(error);
    function finish(error?: Error): void {
      clearTimeout(timeout);
      redis.off("ready", onReady);
      redis.off("error", onError);
      if (error) reject(error);
      else resolve();
    }
    redis.once("ready", onReady);
    redis.once("error", onError);
  });
}

export async function getConnectedRedis(): Promise<Redis | undefined> {
  const redis = getRedisClient();
  if (!redis) return undefined;
  try {
    if (redis.status === "wait" || redis.status === "end") await redis.connect();
    else if (redis.status !== "ready") await waitUntilReady(redis);
    return redis;
  } catch (error) {
    connectionWarning(error);
    throw error;
  }
}

export async function redisHealth(): Promise<{ configured: boolean; reachable: boolean }> {
  if (!env.REDIS_URL) return { configured: false, reachable: false };
  try {
    const redis = await getConnectedRedis();
    return { configured: true, reachable: (await redis?.ping()) === "PONG" };
  } catch {
    return { configured: true, reachable: false };
  }
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  const active = client;
  client = undefined;
  if (active.status === "ready") await active.quit().catch(() => active.disconnect());
  else active.disconnect();
}
