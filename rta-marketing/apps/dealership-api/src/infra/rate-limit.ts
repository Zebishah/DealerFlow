import { createHmac } from "node:crypto";
import { ipKeyGenerator, rateLimit, type ClientRateLimitInfo, type Options, type Store } from "express-rate-limit";
import type Redis from "ioredis";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { getConnectedRedis } from "./redis.js";

const INCREMENT_SCRIPT = `
local total = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if total == 1 or ttl < 0 then
  redis.call('PEXPIREAT', KEYS[1], ARGV[1])
  ttl = redis.call('PTTL', KEYS[1])
end
return { total, ttl }
`;

const DECREMENT_SCRIPT = `
local total = redis.call('DECR', KEYS[1])
if total <= 0 then redis.call('DEL', KEYS[1]); return 0 end
return total
`;

export interface RedisRateLimitCommands {
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>;
  del(key: string): Promise<number>;
}

export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  windowMs: number;

  constructor(
    private readonly redis: RedisRateLimitCommands,
    private readonly namespace: string,
    windowMs: number,
    private readonly resetAt: (now: number, windowMs: number) => number = (now, duration) => now + duration,
    private readonly datePartitioned = false,
  ) {
    this.windowMs = windowMs;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(key: string, now = Date.now()): string {
    const day = this.datePartitioned ? `${new Date(now).toISOString().slice(0, 10)}:` : "";
    return `rta:ratelimit:${this.namespace}:${day}${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = Date.now();
    const expiry = this.resetAt(now, this.windowMs);
    try {
      const result = await this.redis.eval(INCREMENT_SCRIPT, 1, this.key(key, now), expiry);
      if (!Array.isArray(result) || result.length < 2) throw new Error("Invalid Redis increment response");
      const totalHits = Number(result[0]);
      const ttl = Number(result[1]);
      if (!Number.isSafeInteger(totalHits) || totalHits < 1 || !Number.isFinite(ttl)) throw new Error("Invalid Redis rate-limit counter");
      return { totalHits, resetTime: new Date(now + Math.max(0, ttl)) };
    } catch {
      throw new AppError(503, "RATE_LIMIT_STORE_UNAVAILABLE", "Request protection is temporarily unavailable. Please try again shortly.");
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.redis.eval(DECREMENT_SCRIPT, 1, this.key(key));
    } catch {
      throw new AppError(503, "RATE_LIMIT_STORE_UNAVAILABLE", "Request protection is temporarily unavailable. Please try again shortly.");
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await this.redis.del(this.key(key));
    } catch {
      throw new AppError(503, "RATE_LIMIT_STORE_UNAVAILABLE", "Request protection is temporarily unavailable. Please try again shortly.");
    }
  }
}

export function utcDayResetAt(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

export function privacySafeIdentifier(namespace: string, identifier: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`${namespace}\0${identifier}`).digest("hex");
}

export function rateLimitIdentity(request: Parameters<NonNullable<Options["keyGenerator"]>>[0], mode: "ip" | "user-or-ip" = "ip"): string {
  if (mode === "user-or-ip" && request.user?.id) return `user:${request.user.id}`;
  return `ip:${ipKeyGenerator(request.ip || "unknown")}`;
}

export async function createRedisRateLimitStore(
  namespace: string,
  windowMs: number,
  options: { dailyUtc?: boolean; redis?: RedisRateLimitCommands } = {},
): Promise<RedisRateLimitStore | undefined> {
  const redis = options.redis ?? await getConnectedRedis() as Redis | undefined;
  if (!redis) return undefined;
  return new RedisRateLimitStore(redis, namespace, windowMs, options.dailyUtc ? utcDayResetAt : undefined, options.dailyUtc ?? false);
}

export function createRateLimitStore(options: {
  namespace: string;
  windowMs: number;
  redisUrl?: string;
  dailyUtc?: boolean;
  redis?: RedisRateLimitCommands;
}): Store | undefined {
  if (!options.redisUrl) return undefined;
  if (options.redis) {
    return new RedisRateLimitStore(options.redis, options.namespace, options.windowMs, options.dailyUtc ? utcDayResetAt : undefined, options.dailyUtc ?? false);
  }
  return new RedisRateLimitStoreProxy(options.namespace, options.windowMs, options.dailyUtc ?? false);
}

type RateLimitOptions = Partial<Omit<Options, "store" | "keyGenerator" | "windowMs" | "limit">> & {
  namespace: string;
  windowMs: number;
  limit: number;
  identityMode?: "ip" | "user-or-ip";
  dailyUtc?: boolean;
  store?: Store;
};

export function createRateLimiter(options: RateLimitOptions) {
  const { namespace, windowMs, limit, identityMode = "ip", dailyUtc = false, store, ...rest } = options;
  const selectedStore = store ?? createRateLimitStore({
    namespace,
    windowMs,
    dailyUtc,
    ...(env.REDIS_URL ? { redisUrl: env.REDIS_URL } : {}),
  });
  return rateLimit({
    ...rest,
    windowMs,
    limit,
    ...(selectedStore ? { store: selectedStore } : {}),
    keyGenerator: (request) => privacySafeIdentifier(namespace, rateLimitIdentity(request, identityMode)),
  });
}

class RedisRateLimitStoreProxy implements Store {
  readonly localKeys = false;
  windowMs: number;

  constructor(private readonly namespace: string, windowMs: number, private readonly dailyUtc: boolean) {
    this.windowMs = windowMs;
  }

  private async store(): Promise<RedisRateLimitStore> {
    const redis = await createRedisRateLimitStore(this.namespace, this.windowMs, { dailyUtc: this.dailyUtc });
    if (!redis) throw new AppError(503, "RATE_LIMIT_STORE_UNAVAILABLE", "Request protection is temporarily unavailable. Please try again shortly.");
    return redis;
  }

  init(options: Options): void { this.windowMs = options.windowMs; }
  async increment(key: string): Promise<ClientRateLimitInfo> { return (await this.store()).increment(key); }
  async decrement(key: string): Promise<void> { return (await this.store()).decrement(key); }
  async resetKey(key: string): Promise<void> { return (await this.store()).resetKey(key); }
}
