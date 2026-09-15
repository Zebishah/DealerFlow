import assert from "node:assert/strict";
import test from "node:test";
import type { BaseScraperConfig, ScrapedItem } from "@rta/shared";
import { runActorScrape } from "./run.js";

const config = { NODE_ENV: "test", DATABASE_URL: "postgres://localhost/rta", SCRAPER_USER_AGENT: "RTA-Actor-Test/1.0 (+https://example.com)", CRAWLEE_MEMORY_MBYTES: 3000, SCRAPER_SITES_JSON: "[]", SCRAPE_DEFAULT_LIMIT: 5, SCRAPE_MAX_LIMIT: 10, SCRAPE_NAVIGATION_TIMEOUT_MS: 20000, SCRAPE_SELECTOR_TIMEOUT_MS: 8000, SCRAPE_JOB_TIMEOUT_MS: 60000, sites: [{ key: "collector-car-list", name: "CollectorCarList", baseUrl: "https://www.collectorcarlist.com/", engine: "cheerio", itemSelector: 'a[href^="/listings/"]', titleSelector: "h3", priceSelector: "div > p", linkSelector: 'a[href^="/listings/"]', delayMs: 0, maxConcurrency: 1 }] } as BaseScraperConfig;
const item = (id: string): ScrapedItem => ({ title: id, price: null, year: null, mileage: null, city: null, listingUrl: `https://www.collectorcarlist.com/listings/${id}`, thumbnailUrl: null, rawData: {} });

test("actor persists fewer discovered items as a successful maximum-target scrape", async () => {
  let persisted = 0;
  const output = await runActorScrape({ siteKey: "collector-car-list", limit: 5 }, config, { verifyDatabase: async () => undefined, scrapeSite: async () => [item("one"), item("two"), item("three")], persistScrapedItems: async (_site, items) => { persisted = items.length; } });
  assert.equal(output.status, "completed");
  assert.equal(output.requestedCount, 5);
  assert.equal(output.foundCount, 3);
  assert.equal(persisted, 3);
});

test("actor treats a normally loaded page with zero items as successful", async () => {
  const output = await runActorScrape({ siteKey: "collector-car-list", limit: 10 }, config, { verifyDatabase: async () => undefined, scrapeSite: async () => [], persistScrapedItems: async () => undefined });
  assert.deepEqual({ status: output.status, requestedCount: output.requestedCount, foundCount: output.foundCount }, { status: "completed", requestedCount: 10, foundCount: 0 });
});

test("technical scrape and persistence failures remain failures", async () => {
  await assert.rejects(() => runActorScrape({ siteKey: "collector-car-list", limit: 5 }, config, { verifyDatabase: async () => undefined, scrapeSite: async () => { throw new Error("navigation failed"); }, persistScrapedItems: async () => undefined }), /navigation failed/);
  await assert.rejects(() => runActorScrape({ siteKey: "collector-car-list", limit: 5 }, config, { verifyDatabase: async () => undefined, scrapeSite: async () => [item("one")], persistScrapedItems: async () => { throw new Error("database failed"); } }), /database failed/);
});
