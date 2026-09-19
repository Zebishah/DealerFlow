import { createHash, createHmac } from "node:crypto";
import type Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { getConnectedRedis } from "./redis.js";
import { incrementMetric } from "./metrics.js";

export type CacheNamespace = "dashboard" | "source-health" | "catalog" | "scraped-inventory";

export interface RedisCacheCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>;
  del(key: string): Promise<number>;
}

export interface CacheAsideOptions<T> {
  namespace: CacheNamespace;
  scope: string;
  filters: unknown;
  ttlSeconds: number;
  load: () => Promise<T>;
  redis?: RedisCacheCommands | null;
}

const BUMP_VERSION_SCRIPT = `
local version = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[1])
return version
`;
const VERSION_TTL_SECONDS = 7 * 24 * 60 * 60;
let lastCacheWarningAt = 0;

function warnCacheUnavailable(): void {
  const now = Date.now();
  if (now - lastCacheWarningAt < 30_000) return;
  lastCacheWarningAt = now;
  incrementMetric("redis_failures");
  logger.warn({ event: "redis_cache_degraded" }, "Redis cache unavailable; serving data from PostgreSQL");
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record).filter((key) => record[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function scopeDigest(scope: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(scope).digest("hex").slice(0, 24);
}

export function buildCacheVersionKey(namespace: CacheNamespace): string {
  return `rta:cache:version:${namespace}`;
}

export function buildCacheKey(namespace: CacheNamespace, version: string, scope: string, filters: unknown): string {
  const filterHash = createHash("sha256").update(canonicalize(filters)).digest("hex").slice(0, 32);
  return `rta:cache:${namespace}:v${version}:${scopeDigest(scope)}:${filterHash}`;
}

export async function cacheAside<T>(options: CacheAsideOptions<T>): Promise<T> {
  let redis: RedisCacheCommands | undefined;
  try {
    redis = options.redis === undefined ? await getConnectedRedis() as Redis | undefined : options.redis ?? undefined;
  } catch {
    warnCacheUnavailable();
    return options.load();
  }
  if (!redis) return options.load();

  let cacheKey: string;
  try {
    const version = await redis.get(buildCacheVersionKey(options.namespace)) ?? "0";
    cacheKey = buildCacheKey(options.namespace, version, options.scope, options.filters);
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      try {
        incrementMetric("cache_hits");
        logger.debug({ event: "redis_cache_hit", namespace: options.namespace }, "Redis cache hit");
        return JSON.parse(cached) as T;
      } catch {
        await redis.del(cacheKey).catch(() => undefined);
      }
    }
    incrementMetric("cache_misses");
    logger.debug({ event: "redis_cache_miss", namespace: options.namespace }, "Redis cache miss");
  } catch {
    warnCacheUnavailable();
    return options.load();
  }

  const result = await options.load();
  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", options.ttlSeconds);
  } catch {
    warnCacheUnavailable();
  }
  return result;
}

export async function bumpCacheVersions(
  namespaces: readonly CacheNamespace[],
  redisOverride?: RedisCacheCommands | null,
): Promise<void> {
  let redis: RedisCacheCommands | undefined;
  try {
    redis = redisOverride === undefined ? await getConnectedRedis() as Redis | undefined : redisOverride ?? undefined;
  } catch {
    warnCacheUnavailable();
    return;
  }
  if (!redis) return;
  for (const namespace of new Set(namespaces)) {
    try {
      await redis.eval(BUMP_VERSION_SCRIPT, 1, buildCacheVersionKey(namespace), VERSION_TTL_SECONDS);
    } catch {
      warnCacheUnavailable();
      return;
    }
  }
}

export function cacheNamespacesForMutation(method: string, path: string): CacheNamespace[] {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) return [];
  if (path.startsWith("/api/v1/dealership/")) return ["dashboard"];
  if (path.startsWith("/api/v1/sources/")) return ["source-health"];
  if (path.startsWith("/api/v1/scrape-runs")) return ["dashboard", "catalog"];
  return [];
}

export function cacheNamespacesForActorCompletion(previousStatus: string, nextStatus: string): CacheNamespace[] {
  const terminal = new Set(["completed", "failed", "cancelled"]);
  return nextStatus === "completed" && !terminal.has(previousStatus)
    ? ["scraped-inventory", "source-health", "dashboard"]
    : [];
}

export function cacheInvalidationMiddleware(
  bump: (namespaces: readonly CacheNamespace[]) => Promise<void> = bumpCacheVersions,
) {
  return (request: { method: string; originalUrl: string }, response: { statusCode: number; once(event: string, listener: () => void): unknown }, next: (error?: unknown) => void): void => {
    const path = request.originalUrl.split("?", 1)[0] ?? "";
    const namespaces = cacheNamespacesForMutation(request.method, path);
    if (namespaces.length) {
      response.once("finish", () => {
        if (response.statusCode >= 200 && response.statusCode < 400) void bump(namespaces);
      });
    }
    next();
  };
}

export function cacheScope(workspaceId: string | null | undefined, visibility = "standard"): string {
  return `${workspaceId ?? "global"}:${visibility}`;
}

export function isCacheRedisConfigured(): boolean {
  return Boolean(env.REDIS_URL);
}
