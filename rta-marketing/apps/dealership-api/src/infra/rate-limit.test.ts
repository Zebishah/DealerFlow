import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { AppError } from "../lib/errors.js";
import { createAssistantRouter } from "../modules/assistant/routes.js";
import { createRateLimitStore, createRedisRateLimitStore, privacySafeIdentifier, RedisRateLimitStore, utcDayResetAt, type RedisRateLimitCommands } from "./rate-limit.js";

class CounterRedis implements RedisRateLimitCommands {
  readonly counters = new Map<string, { value: number; expiresAt: number }>();
  fail = false;

  async eval(script: string, _numberOfKeys: number, ...args: Array<string | number>): Promise<unknown> {
    if (this.fail) throw new Error("backend disconnected");
    const key = String(args[0]);
    const now = Date.now();
    let entry = this.counters.get(key);
    if (entry && entry.expiresAt <= now) {
      this.counters.delete(key);
      entry = undefined;
    }
    if (script.includes("local total = redis.call('INCR'")) {
      const expiry = Number(args[1]);
      if (!entry) entry = { value: 0, expiresAt: expiry };
      entry.value += 1;
      if (entry.expiresAt <= now) entry.expiresAt = expiry;
      this.counters.set(key, entry);
      return [entry.value, entry.expiresAt - now];
    }
    if (script.includes("redis.call('DECR'")) {
      if (!entry) return 0;
      entry.value -= 1;
      if (entry.value <= 0) this.counters.delete(key);
      return Math.max(entry.value, 0);
    }
    throw new Error("Unexpected Redis script");
  }

  async del(key: string): Promise<number> {
    return Number(this.counters.delete(key));
  }
}

void test("rate-limit Redis store shares atomic counters across instances and namespaces", async () => {
  const redis = new CounterRedis();
  const first = new RedisRateLimitStore(redis, "api", 60_000);
  const second = new RedisRateLimitStore(redis, "api", 60_000);
  const otherNamespace = new RedisRateLimitStore(redis, "auth", 60_000);
  const counts = await Promise.all(Array.from({ length: 24 }, (_, index) => (index % 2 ? first : second).increment("hashed-principal")));
  assert.equal(Math.max(...counts.map(({ totalHits }) => totalHits)), 24);
  assert.equal(redis.counters.get("rta:ratelimit:api:hashed-principal")?.value, 24);
  assert.equal((await otherNamespace.increment("hashed-principal")).totalHits, 1);
  assert.notEqual(privacySafeIdentifier("api", "203.0.113.5"), "203.0.113.5");
  assert.notEqual(privacySafeIdentifier("api", "same"), privacySafeIdentifier("auth", "same"));
});

void test("daily quota uses one UTC-date key and expires at the next UTC midnight", async () => {
  const redis = new CounterRedis();
  const store = new RedisRateLimitStore(redis, "ai:daily", 86_400_000, utcDayResetAt, true);
  const beforeMidnight = Date.UTC(2026, 8, 18, 23, 59, 59, 500);
  const expectedReset = Date.UTC(2026, 8, 19);
  const originalNow = Date.now;
  Date.now = () => beforeMidnight;
  try {
    const first = await store.increment("principal-hash");
    const second = await store.increment("principal-hash");
    assert.equal(first.totalHits, 1);
    assert.equal(second.totalHits, 2);
    assert.equal(first.resetTime?.getTime(), expectedReset);
    assert.equal([...redis.counters.keys()][0], "rta:ratelimit:ai:daily:2026-09-18:principal-hash");
    Date.now = () => expectedReset + 1;
    assert.equal((await store.increment("principal-hash")).totalHits, 1);
    assert.ok(redis.counters.has("rta:ratelimit:ai:daily:2026-09-19:principal-hash"));
  } finally {
    Date.now = originalNow;
  }
});

void test("Redis-backed daily AI quota is shared by router instances and blocks only after the configured count", async () => {
  const redis = new CounterRedis();
  const firstDailyStore = await createRedisRateLimitStore("ai:daily", 86_400_000, { redis, dailyUtc: true });
  const secondDailyStore = await createRedisRateLimitStore("ai:daily", 86_400_000, { redis, dailyUtc: true });
  assert.ok(firstDailyStore && secondDailyStore);
  const app = express();
  app.use(express.json());
  app.use(createAssistantRouter({ rateLimitMax: 100, dailyQuota: 2, dailyQuotaStore: firstDailyStore }));
  const secondApp = express();
  secondApp.use(express.json());
  secondApp.use(createAssistantRouter({ rateLimitMax: 100, dailyQuota: 2, dailyQuotaStore: secondDailyStore }));
  const servers: Server[] = [createServer(app), createServer(secondApp)];
  const urls: string[] = [];
  try {
    for (const server of servers) {
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("AI quota test server did not start");
      urls.push(`http://127.0.0.1:${address.port}`);
    }
    const post = (url: string) => fetch(`${url}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "What does RTA do?" }) });
    assert.equal((await post(urls[0]!)).status, 200);
    assert.equal((await post(urls[1]!)).status, 200);
    const blocked = await post(urls[0]!);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json() as { error: { code: string } }).error.code, "AI_DAILY_QUOTA_EXCEEDED");
    assert.equal([...redis.counters.values()].find(({ value }) => value === 3)?.value, 3);
  } finally {
    await Promise.all(servers.map((server) => new Promise<void>((resolve, reject) => {
      if (!server.listening) return resolve();
      server.close((error) => error ? reject(error) : resolve());
    })));
  }
});

void test("configured Redis failures fail closed with a sanitized availability error", async () => {
  const redis = new CounterRedis();
  redis.fail = true;
  const store = new RedisRateLimitStore(redis, "auth", 1_000);
  await assert.rejects(store.increment("hash"), (error: unknown) => error instanceof AppError && error.statusCode === 503 && error.code === "RATE_LIMIT_STORE_UNAVAILABLE");
});

void test("rate-limit configuration falls back to the built-in memory store when REDIS_URL is absent", async () => {
  assert.equal(createRateLimitStore({ namespace: "api", windowMs: 1_000 }), undefined);
  assert.equal(await createRedisRateLimitStore("api", 1_000), undefined);
});

void test("rate-limit configuration selects the Redis store when REDIS_URL exists", () => {
  const store = createRateLimitStore({ namespace: "api", windowMs: 60_000, redisUrl: "rediss://user:secret@example.invalid:6379", redis: new CounterRedis() });
  assert.ok(store instanceof RedisRateLimitStore);
});
