import assert from "node:assert/strict";
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
  assert.equal(apifySiteKeyForBaseUrl("https://www.tomhartley.com/used/"), "tom-hartley");
  assert.equal(sourceExecutionMetadata("https://www.pakwheels.com/used-cars/search/-/").executionProvider, "legacy");
  assert.equal(sourceExecutionMetadata("https://collectorcarlist.example/").executionProvider, "reference");
  assert.equal(isApprovedImageHost("bluesky.cdn.imgeng.in"), true);
  assert.equal(isApprovedImageHost("www.tomhartley.com"), true);
  assert.equal(isApprovedImageHost("evil.example"), false);
});
