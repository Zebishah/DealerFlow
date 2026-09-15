import assert from "node:assert/strict";
import test from "node:test";
import { parseActorInput } from "./input.js";
import type { BaseScraperConfig } from "@rta/shared";

const config = { NODE_ENV: "test", DATABASE_URL: "postgres://localhost/rta", SCRAPER_USER_AGENT: "RTA-Actor-Test/1.0 (+https://example.com)", CRAWLEE_MEMORY_MBYTES: 3000, SCRAPER_SITES_JSON: "[]", SCRAPE_DEFAULT_LIMIT: 5, SCRAPE_MAX_LIMIT: 10, SCRAPE_NAVIGATION_TIMEOUT_MS: 20000, SCRAPE_SELECTOR_TIMEOUT_MS: 8000, SCRAPE_JOB_TIMEOUT_MS: 60000, sites: [{ key: "collector-car-list", name: "CollectorCarList", baseUrl: "https://www.collectorcarlist.com/", engine: "cheerio", itemSelector: 'a[href^="/listings/"]', titleSelector: "h3", priceSelector: "div > p", linkSelector: 'a[href^="/listings/"]', delayMs: 0, maxConcurrency: 1 }] } as BaseScraperConfig;

test("valid actor input uses the approved source and maximum limit", () => {
  assert.deepEqual(parseActorInput({ siteKey: "collector-car-list", limit: 10 }, config), { siteKey: "collector-car-list", limit: 10 });
});

test("actor input rejects an unapproved source and invalid limits", () => {
  assert.throws(() => parseActorInput({ siteKey: "classics-autotrader", limit: 5 }, config), /not an approved/);
  assert.throws(() => parseActorInput({ siteKey: "collector-car-list", limit: 11 }, config), /cannot exceed/);
});
