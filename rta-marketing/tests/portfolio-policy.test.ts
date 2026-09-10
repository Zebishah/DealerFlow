import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { assertSafeScraperUrl, assertSingleSourcePayload, appConfigSchema, canReleaseScrapeLock, findConfiguredSite, isScrapeTokenValid, manualScrapeJobId, parseScrapeLimit, rateLimitDecision, SCRAPE_LOCK_REFRESH_SCRIPT, SCRAPE_LOCK_RELEASE_SCRIPT } from "../packages/shared/src/index.ts";
import { runCrawlerWithTimeout } from "../packages/scrapers/src/common.ts";
import { PLAYWRIGHT_MAX_CONCURRENCY, PLAYWRIGHT_MAX_OPEN_PAGES_PER_BROWSER, PLAYWRIGHT_MIN_CONCURRENCY } from "../packages/scrapers/src/olx.ts";
import { scrapeSyntheticSource } from "../packages/scrapers/src/mock-source.ts";

const defaultLimit = 5;
const maxLimit = 10;

test("uses five vehicles when no limit is provided", () => {
  assert.equal(parseScrapeLimit(undefined, defaultLimit, maxLimit), 5);
});

test("accepts limits five and ten", () => {
  assert.equal(parseScrapeLimit(5, defaultLimit, maxLimit), 5);
  assert.equal(parseScrapeLimit(10, defaultLimit, maxLimit), 10);
});

test("rejects zero, negative, fractional, string, and over-limit values", () => {
  for (const value of [0, -1, 10.5, "5", 11, 1000]) {
    assert.throws(() => parseScrapeLimit(value, defaultLimit, maxLimit));
  }
});

test("rejects unknown sources and multi-source request shapes", () => {
  const sites = [{ key: "pakwheels" }] as never[];
  assert.throws(() => findConfiguredSite("evil", sites));
  assert.throws(() => assertSingleSourcePayload({ siteKeys: ["pakwheels", "olx-pakistan"] }));
  assert.throws(() => assertSingleSourcePayload({ sites: ["pakwheels"] }));
  assert.throws(() => assertSingleSourcePayload({ all: true }));
  assert.throws(() => assertSingleSourcePayload({ siteKey: "pakwheels", limit: 5, url: "http://169.254.169.254" }));
  assert.throws(() => assertSingleSourcePayload({ siteKey: "pakwheels", limit: 5, baseUrl: "https://evil.example" }));
  assert.throws(() => assertSingleSourcePayload(JSON.parse('{"siteKey":"pakwheels","limit":5,"__proto__":{}}')));
  assert.doesNotThrow(() => assertSingleSourcePayload({ siteKey: "pakwheels", limit: 5 }));
});

test("rejects missing or invalid scrape tokens and accepts only the authorized token", () => {
  assert.equal(isScrapeTokenValid(undefined, undefined), false);
  assert.equal(isScrapeTokenValid("a".repeat(32), undefined), false);
  assert.equal(isScrapeTokenValid("a".repeat(32), "b".repeat(32)), false);
  assert.equal(isScrapeTokenValid("a".repeat(32), "a".repeat(32)), true);
});

test("frontend source contains no scrape secret or public token environment variable", async () => {
  const source = await readFile(new URL("../apps/scraping-web/src/App.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /SCRAPE_TRIGGER_TOKEN|VITE_SCRAPE/);
});

test("rejects dangerous configured scraper URLs while allowing public HTTPS sites", () => {
  for (const value of [
    "file:///etc/passwd",
    "ftp://example.com/feed",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://10.0.0.1",
    "http://172.16.0.1",
    "http://192.168.1.10",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]:8080",
    "http://service.internal",
  ]) assert.throws(() => assertSafeScraperUrl(value));
  assert.doesNotThrow(() => assertSafeScraperUrl("https://www.pakwheels.com/used-cars/search/-/"));
});

test("rate limiting returns a 429 decision after the configured maximum", () => {
  assert.equal(rateLimitDecision(3, 3, 60_000).allowed, true);
  assert.equal(rateLimitDecision(4, 3, 60_000).allowed, false);
  assert.equal(rateLimitDecision(4, 3, 60_000).retryAfterSeconds, 60);
});

test("lock scripts use ownership checks and the lock TTL is bounded", () => {
  assert.match(SCRAPE_LOCK_RELEASE_SCRIPT, /get.*ARGV\[1\].*del/);
  assert.match(SCRAPE_LOCK_REFRESH_SCRIPT, /get.*ARGV\[1\].*expire/);
  assert.equal(canReleaseScrapeLock("owner-a", "owner-a"), true);
  assert.equal(canReleaseScrapeLock("owner-a", "owner-b"), false);
  assert.equal(canReleaseScrapeLock(null, "owner-a"), false);
  const config = appConfigSchema.parse({ DATABASE_URL: "https://example.com/neon" });
  assert.ok(config.SCRAPE_LOCK_TTL_SECONDS > config.SCRAPE_JOB_TIMEOUT_MS / 1_000);
});

test("job IDs are deterministic per source but isolated between sources", () => {
  assert.equal(manualScrapeJobId("pakwheels"), manualScrapeJobId("pakwheels"));
  assert.notEqual(manualScrapeJobId("pakwheels"), manualScrapeJobId("olx-pakistan"));
});

test("manual-only and one-worker defaults are enforced by configuration", () => {
  const config = appConfigSchema.parse({ DATABASE_URL: "https://example.com/neon" });
  assert.equal(config.MANUAL_SCRAPING_ONLY, true);
  assert.equal(config.WORKER_CONCURRENCY, 1);
  assert.equal(config.CRAWLEE_MEMORY_MBYTES, 450);
  assert.equal(config.SCRAPE_DEFAULT_LIMIT, 5);
  assert.equal(config.SCRAPE_MAX_LIMIT, 10);
});

test("Playwright crawler stays at one task, one page, with a constrained Crawlee budget", () => {
  const config = appConfigSchema.parse({ DATABASE_URL: "https://example.com/neon", CRAWLEE_MEMORY_MBYTES: "400" });
  assert.equal(config.CRAWLEE_MEMORY_MBYTES, 400);
  assert.equal(PLAYWRIGHT_MIN_CONCURRENCY, 1);
  assert.equal(PLAYWRIGHT_MAX_CONCURRENCY, 1);
  assert.equal(PLAYWRIGHT_MAX_OPEN_PAGES_PER_BROWSER, 1);
  assert.throws(() => appConfigSchema.parse({ DATABASE_URL: "https://example.com/neon", CRAWLEE_MEMORY_MBYTES: "451" }));
});

test("synthetic scraper returns no more than the requested maximum", async () => {
  const site = { key: "demo-synthetic", name: "Demo", baseUrl: "https://demo.synthetic.invalid", engine: "cheerio", itemSelector: "article", titleSelector: "h2", priceSelector: ".price", linkSelector: "a", delayMs: 0, maxConcurrency: 1 } as const;
  const items = await scrapeSyntheticSource(site, { userAgent: "RTA-Portfolio-Scraper/1.0 (+https://example.com/contact)", delayMs: 0, maxConcurrency: 1, limit: 10, crawleeMemoryMbytes: 450, navigationTimeoutMs: 30_000, selectorTimeoutMs: 15_000, jobTimeoutMs: 120_000 });
  assert.equal(items.length, 10);
});

test("crawler teardown runs after success, exception, and timeout", async () => {
  let successfulTeardowns = 0;
  await runCrawlerWithTimeout({
    run: async () => undefined,
    teardown: async () => { successfulTeardowns += 1; },
  }, "https://example.com", 50);
  assert.equal(successfulTeardowns, 1);

  let failedTeardowns = 0;
  await assert.rejects(() => runCrawlerWithTimeout({
    run: async () => { throw new Error("scrape failed"); },
    teardown: async () => { failedTeardowns += 1; },
  }, "https://example.com", 50));
  assert.equal(failedTeardowns, 1);

  let timedOutTeardowns = 0;
  await assert.rejects(() => runCrawlerWithTimeout({
    run: async () => new Promise<void>(() => undefined),
    teardown: async () => { timedOutTeardowns += 1; },
  }, "https://example.com", 10), /exceeded 10ms/);
  assert.ok(timedOutTeardowns >= 1);
});
