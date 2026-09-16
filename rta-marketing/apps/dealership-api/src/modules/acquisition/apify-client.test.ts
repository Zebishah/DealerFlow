import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ApifyClient, mapApifyStatus } from "./apify-client.js";
import type { ApifyClientError } from "./apify-client.js";
import { apifySiteKeyForBaseUrl, isApprovedImageHost, sourceExecutionMetadata } from "./source-mapping.js";

const runPayload = { data: { id: "run-123", status: "READY", defaultKeyValueStoreId: "store-123" } };
const client = (fetchImpl: typeof fetch) => new ApifyClient({ token: "secret-token", actorId: "actor~id", baseUrl: "https://api.apify.test/v2", timeoutMs: 100, fetchImpl });

void test("Apify client starts runs and reads status/output metadata", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await client(async (input, init) => {
    const request = { url: String(input) } as { url: string; init?: RequestInit };
    if (init) request.init = init;
    requests.push(request);
    if (String(input).includes("/records/OUTPUT")) return new Response(JSON.stringify({ value: { requestedCount: 5, foundCount: 3, durationMs: 1200, timings: { extractionMs: 80 } } }), { status: 200 });
    if (String(input).includes("/actor-runs/")) return new Response(JSON.stringify({ data: { ...runPayload.data, status: "SUCCEEDED", finishedAt: "2026-01-01T00:00:02.000Z" } }), { status: 200 });
    return new Response(JSON.stringify(runPayload), { status: 200 });
  }).startRun("tom-hartley", 5);
  assert.equal(result.id, "run-123");
  const status = await client(async () => new Response(JSON.stringify({ data: { ...runPayload.data, status: "RUNNING" } }), { status: 200 })).getRun("run-123");
  assert.equal(status.status, "RUNNING");
  const output = await client(async () => new Response(JSON.stringify({ value: { requestedCount: 5, foundCount: 3, durationMs: 1200, timings: { extractionMs: 80 } } }), { status: 200 })).getOutput({ ...status, defaultKeyValueStoreId: "store-123" });
  assert.deepEqual(output, { requestedCount: 5, foundCount: 3, durationMs: 1200, timings: { extractionMs: 80 } });
  assert.match(requests[0]!.url, /\/acts\/actor~id\/runs$/);
  assert.equal((requests[0]!.init?.headers as Record<string, string>).Authorization, "Bearer secret-token");
  assert.match(String(requests[0]!.init?.body), /"siteKey":"tom-hartley"/);
});

void test("Apify client classifies timeout, network, credentials, not-found, rate-limit, server, and malformed failures", async () => {
  const cases: Array<{ status?: number; error?: Error; kind: string }> = [
    { error: new DOMException("timed out", "TimeoutError"), kind: "timeout" },
    { error: new Error("socket failed"), kind: "network" },
    { status: 401, kind: "credentials" },
    { status: 404, kind: "not-found" },
    { status: 429, kind: "rate-limited" },
    { status: 500, kind: "upstream" },
  ];
  for (const value of cases) {
    let caught: unknown;
    try {
      await client(async () => value.error ? Promise.reject(value.error) : new Response(JSON.stringify({ error: "safe" }), { status: value.status } as ResponseInit)).startRun("romans-international", 5);
      assert.fail("expected Apify request to fail");
    } catch (error) {
      caught = error;
    }
    assert.equal((caught as ApifyClientError).kind, value.kind);
  }
  let malformed: unknown;
  try {
    await client(async () => new Response("not-json", { status: 200 })).startRun("romans-international", 5);
    assert.fail("expected malformed response to fail");
  } catch (error) {
    malformed = error;
  }
  assert.equal((malformed as ApifyClientError).kind, "malformed");
});

void test("Apify statuses map to safe dashboard states", () => {
  assert.equal(mapApifyStatus("READY"), "queued");
  assert.equal(mapApifyStatus("RUNNING"), "scraping");
  assert.equal(mapApifyStatus("SUCCEEDED"), "completed");
  assert.equal(mapApifyStatus("FAILED"), "failed");
  assert.equal(mapApifyStatus("TIMED-OUT"), "failed");
  assert.equal(mapApifyStatus("ABORTED"), "cancelled");
  assert.equal(mapApifyStatus("FUTURE_STATUS"), "failed");
});

void test("source mapping exposes only live Apify sources and approved image hosts", () => {
  const liveMappings = [
    ["https://romansinternational.com/used/cars", "romans-international"],
    ["https://www.tomhartley.com/used/", "tom-hartley"],
    ["https://tomhartley.com/used?sort=latest#inventory", "tom-hartley"],
    ["https://www.redlinespecialistcars.co.uk/cars", "redline-specialist-cars"],
  ] as const;
  for (const [baseUrl, siteKey] of liveMappings) {
    assert.equal(apifySiteKeyForBaseUrl(baseUrl), siteKey);
    assert.deepEqual(sourceExecutionMetadata(baseUrl), { siteKey, triggerable: true, executionProvider: "apify" });
  }
  assert.equal(sourceExecutionMetadata("https://www.pakwheels.com/used-cars/search/-/").executionProvider, "legacy");
  assert.equal(sourceExecutionMetadata("https://www.olx.com.pk/cars_c84").executionProvider, "legacy");
  assert.equal(sourceExecutionMetadata("https://www.collectorcarlist.com/").executionProvider, "reference");
  assert.equal(sourceExecutionMetadata("https://generated-inventory.invalid/").executionProvider, "reference");
  assert.equal(isApprovedImageHost("bluesky.cdn.imgeng.in"), true);
  assert.equal(isApprovedImageHost("images.67degreescdn.co.uk"), true);
  assert.equal(isApprovedImageHost("redline.drive-digital.co.uk"), true);
  assert.equal(isApprovedImageHost("www.tomhartley.com"), true);
  assert.equal(isApprovedImageHost("images.olx.com.pk"), true);
  assert.equal(isApprovedImageHost("www.pakwheels.com"), true);
  assert.equal(isApprovedImageHost("www.collectorcarlist.com"), true);
  assert.equal(isApprovedImageHost("evil.example"), false);
  assert.equal(isApprovedImageHost("images.pakwheels.com.attacker.example"), false);
  assert.equal(isApprovedImageHost("images.synthetic.invalid"), false);
});

void test("one-time inventory reset is journaled and preserves only intended source/business tables", () => {
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: Array<{ idx: number; tag: string; when: number; version: string; breakpoints: boolean }>;
  };
  const migration = readFileSync("drizzle/0010_reset_scraped_inventory.sql", "utf8");
  const cascadeMigration = readFileSync("drizzle/0006_saved_scraped_items.sql", "utf8");
  const entry = journal.entries.at(-1);
  assert.ok(entry);
  assert.equal(entry.idx, 10);
  assert.equal(entry.version, "7");
  assert.equal(entry.tag, "0010_reset_scraped_inventory");
  assert.equal(entry.breakpoints, true);
  assert.ok(entry && entry.when > journal.entries.at(-2)!.when);
  const deletedTables = [...migration.matchAll(/DELETE\s+FROM\s+"([^"]+)"/gi)].map((match) => match[1]);
  assert.deepEqual(deletedTables, ["scraped_items", "scrape_actor_runs"]);
  assert.match(cascadeMigration, /REFERENCES\s+"public"\."scraped_items"\("id"\)\s+ON DELETE cascade/i);
  assert.match(migration, /INSERT\s+INTO\s+public\.sites/i);
  assert.match(migration, /https:\/\/www\.romansinternational\.com\/used\/cars\//);
  assert.match(migration, /https:\/\/www\.tomhartley\.com\/used\//);
  assert.match(migration, /https:\/\/redlinespecialistcars\.co\.uk\/cars\//);
});
