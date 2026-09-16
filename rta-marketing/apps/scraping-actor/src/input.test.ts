import assert from "node:assert/strict";
import test from "node:test";
import { parseActorInput } from "./input.js";
import type { BaseScraperConfig } from "@rta/shared";

const config = { NODE_ENV: "test", DATABASE_URL: "postgres://localhost/rta", SCRAPER_USER_AGENT: "RTA-Actor-Test/1.0 (+https://example.com)", CRAWLEE_MEMORY_MBYTES: 3000, SCRAPER_SITES_JSON: "[]", SCRAPE_DEFAULT_LIMIT: 5, SCRAPE_MAX_LIMIT: 10, SCRAPE_NAVIGATION_TIMEOUT_MS: 20000, SCRAPE_SELECTOR_TIMEOUT_MS: 8000, SCRAPE_JOB_TIMEOUT_MS: 60000, sites: [
  { key: "romans-international", name: "Romans International", baseUrl: "https://www.romansinternational.com/used/cars/", engine: "cheerio", itemSelector: ".vehicle--teaser[data-vehicle]", titleSelector: ".vehicle__title", priceSelector: ".vehicle__price", linkSelector: 'a[href*="/used/cars/"]', delayMs: 0, maxConcurrency: 1 },
  { key: "tom-hartley", name: "Tom Hartley", baseUrl: "https://www.tomhartley.com/", engine: "cheerio", itemSelector: "body", titleSelector: "h1", priceSelector: ".price", linkSelector: 'a[href*="/used-car-details/"]', delayMs: 0, maxConcurrency: 1 },
  { key: "redline-specialist-cars", name: "Redline Specialist Cars", baseUrl: "https://redlinespecialistcars.co.uk/", engine: "cheerio", itemSelector: ".col-md-4[data-at-price][data-at-year][data-at-mileage]", titleSelector: ".product-content h4", priceSelector: ".price", linkSelector: ".item-link", delayMs: 0, maxConcurrency: 1 },
] } as BaseScraperConfig;

test("valid actor input accepts all three live sources and maximum limit", () => {
  assert.deepEqual(parseActorInput({ siteKey: "romans-international", limit: 10 }, config), { siteKey: "romans-international", limit: 10 });
  assert.deepEqual(parseActorInput({ siteKey: "tom-hartley", limit: 1 }, config), { siteKey: "tom-hartley", limit: 1 });
  assert.deepEqual(parseActorInput({ siteKey: "redline-specialist-cars" }, config), { siteKey: "redline-specialist-cars", limit: 5 });
  assert.deepEqual(parseActorInput({}, config), { siteKey: "romans-international", limit: 5 });
});

test("actor input rejects an unapproved source and invalid limits", () => {
  assert.throws(() => parseActorInput({ siteKey: "classics-autotrader", limit: 5 }, config), /not an approved/);
  assert.throws(() => parseActorInput({ siteKey: "collector-car-list", limit: 5 }, config), /not an approved/);
  assert.throws(() => parseActorInput({ siteKey: "romans-international", limit: 11 }, config), /cannot exceed/);
});
