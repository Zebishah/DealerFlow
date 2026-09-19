import assert from "node:assert/strict";
import test from "node:test";
import { bumpCacheVersions, buildCacheKey, buildCacheVersionKey, cacheAside, cacheNamespacesForActorCompletion, cacheNamespacesForMutation, type RedisCacheCommands } from "./cache.js";

class CacheRedis implements RedisCacheCommands {
  readonly values = new Map<string, { value: string; expiresAt: number | null }>();
  readonly scripts: Array<{ script: string; key: string }> = [];
  failGet = false;
  malformedValue: string | undefined;

  async get(key: string): Promise<string | null> {
    if (this.failGet) throw new Error("cache unavailable");
    if (this.malformedValue !== undefined && key.startsWith("rta:cache:scraped-inventory:")) return this.malformedValue;
    const entry = this.values.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, _mode: "EX", seconds: number): Promise<unknown> {
    this.values.set(key, { value, expiresAt: Date.now() + seconds * 1_000 });
    return "OK";
  }

  async eval(script: string, _numberOfKeys: number, ...args: Array<string | number>): Promise<unknown> {
    const key = String(args[0]);
    this.scripts.push({ script, key });
    const version = Number(this.values.get(key)?.value ?? "0") + 1;
    this.values.set(key, { value: String(version), expiresAt: Date.now() + Number(args[1]) * 1_000 });
    return version;
  }

  async del(key: string): Promise<number> { return Number(this.values.delete(key)); }
}

void test("cache hit skips PostgreSQL, and normalized filter property order shares a cache key", async () => {
  const redis = new CacheRedis();
  let databaseCalls = 0;
  const load = async () => { databaseCalls += 1; return { ids: [1, 2] }; };
  const first = await cacheAside({ namespace: "catalog", scope: "workspace-a", filters: { q: "ferrari", sort: "newest" }, ttlSeconds: 30, load, redis });
  const second = await cacheAside({ namespace: "catalog", scope: "workspace-a", filters: { sort: "newest", q: "ferrari" }, ttlSeconds: 30, load, redis });
  assert.deepEqual(first, second);
  assert.equal(databaseCalls, 1);
  assert.notEqual(buildCacheKey("catalog", "0", "workspace-a", { q: "ferrari" }), buildCacheKey("catalog", "0", "workspace-a", { q: "porsche" }));
});

void test("cache miss loads PostgreSQL, stores with TTL, and expired data becomes a miss", async () => {
  const redis = new CacheRedis();
  let databaseCalls = 0;
  const options = { namespace: "dashboard" as const, scope: "workspace-b", filters: { view: "summary" }, ttlSeconds: 1, redis, load: async () => ({ active: ++databaseCalls }) };
  assert.deepEqual(await cacheAside(options), { active: 1 });
  assert.equal(databaseCalls, 1);
  const cacheKey = [...redis.values.keys()].find((key) => key.startsWith("rta:cache:dashboard:"));
  assert.ok(cacheKey);
  const entry = redis.values.get(cacheKey!)!;
  entry.expiresAt = Date.now() - 1;
  assert.deepEqual(await cacheAside(options), { active: 2 });
  assert.equal(databaseCalls, 2);
});

void test("malformed cache entries fall back to PostgreSQL and are replaced", async () => {
  const redis = new CacheRedis();
  redis.malformedValue = "not-json";
  let databaseCalls = 0;
  const result = await cacheAside({ namespace: "scraped-inventory", scope: "global", filters: { limit: 10 }, ttlSeconds: 30, redis, load: async () => ({ items: ++databaseCalls }) });
  assert.deepEqual(result, { items: 1 });
  redis.malformedValue = undefined;
  assert.deepEqual(await cacheAside({ namespace: "scraped-inventory", scope: "global", filters: { limit: 10 }, ttlSeconds: 30, redis, load: async () => ({ items: ++databaseCalls }) }), { items: 1 });
  assert.equal(databaseCalls, 1);
});

void test("cache backend errors fail open to PostgreSQL", async () => {
  const redis = new CacheRedis();
  redis.failGet = true;
  let databaseCalls = 0;
  const result = await cacheAside({ namespace: "source-health", scope: "workspace-c", filters: {}, ttlSeconds: 20, redis, load: async () => ({ count: ++databaseCalls }) });
  assert.deepEqual(result, { count: 1 });
  assert.equal(databaseCalls, 1);
});

void test("cache version bump invalidates all filter variants without touching unrelated keys", async () => {
  const redis = new CacheRedis();
  const versionKey = buildCacheVersionKey("scraped-inventory");
  await redis.set("unrelated:queue:key", "untouched", "EX", 60);
  const before = buildCacheKey("scraped-inventory", "0", "public", { q: "a" });
  await redis.set(before, JSON.stringify({ old: true }), "EX", 30);
  await bumpCacheVersions(["scraped-inventory", "source-health"], redis);
  const after = buildCacheKey("scraped-inventory", "1", "public", { q: "a" });
  assert.equal(redis.values.get(versionKey)?.value, "1");
  assert.notEqual(before, after);
  assert.ok(redis.values.has(before));
  assert.equal(redis.values.get("unrelated:queue:key")?.value, "untouched");
  assert.deepEqual(redis.scripts.map(({ key }) => key), [versionKey, buildCacheVersionKey("source-health")]);
});

void test("completed scrape cache generation changes so dashboard and source-health results are refreshed", async () => {
  const redis = new CacheRedis();
  let databaseCalls = 0;
  const cachedDashboard = () => cacheAside({ namespace: "dashboard" as const, scope: "w:telemetry", filters: { view: "summary" }, ttlSeconds: 45, redis, load: async () => ({ generation: ++databaseCalls }) });
  assert.deepEqual(await cachedDashboard(), { generation: 1 });
  assert.deepEqual(await cachedDashboard(), { generation: 1 });
  await bumpCacheVersions(["dashboard", "source-health", "scraped-inventory"], redis);
  assert.deepEqual(await cachedDashboard(), { generation: 2 });
  assert.equal(databaseCalls, 2);
});

void test("mutation invalidation only covers data-changing API families", () => {
  assert.deepEqual(cacheNamespacesForMutation("PATCH", "/api/v1/sources/romans"), ["source-health"]);
  assert.deepEqual(cacheNamespacesForMutation("POST", "/api/v1/dealership/leads"), ["dashboard"]);
  assert.deepEqual(cacheNamespacesForMutation("GET", "/api/v1/dealership/leads"), []);
  assert.deepEqual(cacheNamespacesForMutation("POST", "/api/v1/auth/login"), []);
});

void test("Apify cache invalidation happens only when a persisted run transitions to completed", () => {
  assert.deepEqual(cacheNamespacesForActorCompletion("scraping", "completed"), ["scraped-inventory", "source-health", "dashboard"]);
  assert.deepEqual(cacheNamespacesForActorCompletion("scraping", "failed"), []);
  assert.deepEqual(cacheNamespacesForActorCompletion("completed", "completed"), []);
});
