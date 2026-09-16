import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { callScrapingApi, ScrapingApiTransportError } from "./scraping-client.js";

const response = (status: number, body: unknown = { data: {} }) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

void test("returns immediately when the scraping API is warm", async () => {
  let calls = 0;
  const result = await callScrapingApi({
    baseUrl: "https://scraping.example",
    token: "server-token",
    path: "/health",
    pathCategory: "health",
    fetchImpl: async () => { calls += 1; return response(200, { status: "ok" }); },
  });
  assert.equal(calls, 1);
  assert.equal(result.response.status, 200);
  assert.equal(result.attempt, 1);
});

void test("retries a timeout during cold start and succeeds when Render wakes", async () => {
  let calls = 0;
  let clock = 0;
  const result = await callScrapingApi({
    baseUrl: "https://scraping.example",
    token: "server-token",
    path: "/api/scrape/status",
    pathCategory: "status",
    retryTransient: true,
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds; },
    fetchImpl: async () => {
      calls += 1;
      clock += 10_000;
      if (calls < 3) throw Object.assign(new Error("Render request timed out"), { name: "TimeoutError" });
      return response(200, { data: { activeJob: null } });
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.attempt, 3);
  assert.ok(result.elapsedMs >= 20_000 && result.elapsedMs < 40_000);
});

void test("stops after the bounded warm-up window", async () => {
  let calls = 0;
  let clock = 0;
  await assert.rejects(() => callScrapingApi({
    baseUrl: "https://scraping.example",
    token: "server-token",
    path: "/health",
    pathCategory: "health",
    retryTransient: true,
    now: () => clock,
    sleep: async (milliseconds) => { clock += milliseconds; },
    fetchImpl: async () => {
      calls += 1;
      clock += Math.min(12_000, 55_000 - clock);
      throw Object.assign(new Error("Render unavailable"), { name: "TimeoutError" });
    },
  }), (error: unknown) => error instanceof ScrapingApiTransportError && error.elapsedMs <= 55_000);
  assert.ok(calls > 1);
});

void test("does not retry definitive HTTP responses or ambiguous POSTs", async () => {
  let unauthorizedCalls = 0;
  const unauthorized = await callScrapingApi({
    baseUrl: "https://scraping.example",
    token: "server-token",
    path: "/health",
    pathCategory: "health",
    retryTransient: true,
    fetchImpl: async () => { unauthorizedCalls += 1; return response(401, { error: "denied" }); },
  });
  assert.equal(unauthorized.response.status, 401);
  assert.equal(unauthorizedCalls, 1);

  let conflictCalls = 0;
  const conflict = await callScrapingApi({
    baseUrl: "https://scraping.example",
    token: "server-token",
    path: "/api/scrape/pakwheels",
    pathCategory: "trigger",
    init: { method: "POST" },
    retryTransient: false,
    fetchImpl: async () => { conflictCalls += 1; return response(409, { data: { activeJob: { jobId: "manual-pakwheels" } } }); },
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflictCalls, 1);

  let ambiguousPostCalls = 0;
  await assert.rejects(() => callScrapingApi({
    baseUrl: "https://scraping.example",
    token: "server-token",
    path: "/api/scrape/pakwheels",
    pathCategory: "trigger",
    init: { method: "POST" },
    retryTransient: false,
    fetchImpl: async () => {
      ambiguousPostCalls += 1;
      throw Object.assign(new Error("connection reset after request"), { code: "ECONNRESET" });
    },
  }), ScrapingApiTransportError);
  assert.equal(ambiguousPostCalls, 1);
});

void test("the live dealership path uses Apify and has no warm-up UX", async () => {
  const [route, page] = await Promise.all([
    readFile(join(process.cwd(), "src/modules/acquisition/routes.ts"), "utf8"),
    readFile(join(process.cwd(), "../dealership-web/src/pages/ScrapingResultsPage.tsx"), "utf8"),
  ]);
  assert.match(route, /requireApifyClient/);
  assert.doesNotMatch(route, /callScrapingApiForRoute|SCRAPING_WARMING_UP|SCRAPING_STACK_API_URL/);
  assert.match(page, /Apify scraping pipeline/);
  assert.doesNotMatch(page, /SCRAPER_WARMING_UP|Starting scraping service|worker infrastructure|Docker\/BullMQ/);
});
