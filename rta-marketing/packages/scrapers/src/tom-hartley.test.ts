import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SiteConfig } from "@rta/shared";
import type { CheerioPage } from "./cheerio-runtime.js";
import type { ScraperOptions } from "./common.js";
import { scrapeTomHartley, TomHartleySourceContractError, isTomHartleyVehicleDetailUrl, parseTomHartleyDetailHtml, parseTomHartleyInventoryHtml, parseTomHartleySitemap, yearFromTomHartleyTitle } from "./tom-hartley.js";

const site: SiteConfig = { key: "tom-hartley", name: "Tom Hartley", baseUrl: "https://www.tomhartley.com/used/", engine: "cheerio", strategy: "cards", itemSelector: ".used-list-vehicle-wrap", titleSelector: ".used-list-summary__heading", priceSelector: ".used-list-vehicle__price", linkSelector: 'a[href*="/used-car-details/"]', delayMs: 0, maxConcurrency: 1 };
const fixture = (name: string) => readFile(new URL(`./fixtures/tom-hartley/${name}`, import.meta.url), "utf8");

test("Tom Hartley inventory discovers and deduplicates live card detail links", async () => {
  const discovery = parseTomHartleyInventoryHtml(await fixture("used.html"), site, "https://www.tomhartley.com/used/");
  assert.equal(discovery.diagnostics.matchedCardCount, 7);
  assert.equal(discovery.diagnostics.detailUrlCount, 6);
  assert.deepEqual(discovery.detailUrls.slice(0, 3), [
    "https://www.tomhartley.com/used-car-details/car-one/",
    "https://www.tomhartley.com/used-car-details/car-two/",
    "https://www.tomhartley.com/used-car-details/car-three/",
  ]);
});

test("Tom Hartley rejects inventory pages without detail links unless explicitly empty", async () => {
  await assert.rejects(
    async () => parseTomHartleyInventoryHtml("<html><head><title>Used Cars</title></head><body><main>Inventory loaded</main></body></html>", site, "https://www.tomhartley.com/used/"),
    (error: unknown) => error instanceof TomHartleySourceContractError,
  );
  const empty = parseTomHartleyInventoryHtml("<html><body><main>No vehicles currently available</main></body></html>", site, "https://www.tomhartley.com/used/");
  assert.equal(empty.detailUrls.length, 0);
  assert.equal(empty.diagnostics.validEmptyState, true);
});

test("Tom Hartley sitemap keeps only same-domain vehicle-detail URLs and deduplicates", async () => {
  const urls = parseTomHartleySitemap(await fixture("sitemap.xml"), site);
  assert.deepEqual(urls, [
    "https://www.tomhartley.com/used-car-details/ferrari-roma-1/",
    "https://www.tomhartley.com/used-car-details/porsche-911-2/",
  ]);
  assert.equal(isTomHartleyVehicleDetailUrl("https://www.tomhartley.com/used-car-details/porsche-911-2/"), true);
  assert.equal(isTomHartleyVehicleDetailUrl("https://www.tomhartley.com/about/"), false);
});

test("Tom Hartley prefers valid JSON-LD and falls back to labeled HTML", async () => {
  const item = parseTomHartleyDetailHtml(await fixture("detail.html"), site, "https://www.tomhartley.com/used-car-details/ferrari-roma-1/");
  assert.equal(item.title, "2022 Ferrari Roma");
  assert.equal(item.price, "£164,950");
  assert.equal(item.year, "2022");
  assert.equal(item.mileage, "4,201 miles");
  assert.equal(item.city, "Warwickshire");
  assert.equal(item.thumbnailUrl, "https://images.example.test/roma.jpg");
  assert.equal(item.rawData.make, "Ferrari");

  const fallback = parseTomHartleyDetailHtml(await fixture("malformed-json.html"), site, "https://www.tomhartley.com/used-car-details/porsche-911-2/");
  assert.equal(fallback.title, "2021 Porsche 911");
  assert.equal(fallback.mileage, "8,000 miles");
  assert.equal(fallback.price, "£129,950");
  assert.equal(fallback.thumbnailUrl, "https://images.example.test/porsche.jpg");
});

test("Tom Hartley rejects a broken detail contract", async () => {
  await assert.rejects(async () => parseTomHartleyDetailHtml(await fixture("unexpected.html"), site, "https://www.tomhartley.com/used-car-details/missing/"), (error: unknown) => error instanceof TomHartleySourceContractError);
});

test("Tom Hartley preserves live price status values", () => {
  for (const price of ["£POA", "RESERVED", "UNDER OFFER"]) {
    const item = parseTomHartleyDetailHtml(`<html><body><h1>2024 Ferrari Roma</h1><h4 class="price">${price}</h4></body></html>`, site, "https://www.tomhartley.com/used-car-details/status/");
    assert.equal(item.price, price);
  }
});

test("Tom Hartley derives only clear leading years and avoids branding images", () => {
  assert.equal(yearFromTomHartleyTitle("2025/75 Rolls-Royce Phantom"), "2025");
  assert.equal(yearFromTomHartleyTitle("Rolls-Royce Phantom"), null);
  const item = parseTomHartleyDetailHtml("<html><body><img class=\"site-logo\" src=\"https://www.tomhartley.com/logo.png\"><h1>2025 Ferrari Roma</h1><img data-src=\"https://images.example.test/roma.jpg\"></body></html>", site, "https://www.tomhartley.com/used-car-details/roma/");
  assert.equal(item.year, "2025");
  assert.equal(item.thumbnailUrl, "https://images.example.test/roma.jpg");
});

test("Tom Hartley runtime processes inventory-discovered detail pages and stops at five", async () => {
  const inventoryUrl = "https://www.tomhartley.com/used/";
  const inventory = await fixture("used.html");
  const detailTemplate = await fixture("detail.html");
  const processedDetails: string[] = [];
  const crawl = async (_site: SiteConfig, _options: ScraperOptions, initialUrls: string[], _maxRequests: number, onPage: (page: CheerioPage) => Promise<void>): Promise<void> => {
    const pending = [...initialUrls];
    while (pending.length > 0) {
      const requestUrl = pending.shift()!;
      const isInventory = requestUrl === inventoryUrl;
      if (!isInventory) processedDetails.push(requestUrl);
      const body = isInventory ? inventory : detailTemplate.replace(/https:\/\/www\.tomhartley\.com\/used-car-details\/ferrari-roma-1\//g, requestUrl);
      await onPage({ body, requestUrl, finalUrl: requestUrl, statusCode: 200, addUrl: async (url) => { pending.push(url); } });
    }
  };
  const items = await scrapeTomHartley({ ...site, sitemapUrl: "https://fixture.test/sitemap.xml" }, { userAgent: "RTA-Local-Tom-Hartley/1.0", delayMs: 0, maxConcurrency: 1, limit: 5, crawleeMemoryMbytes: 128, navigationTimeoutMs: 10_000, selectorTimeoutMs: 2_000, jobTimeoutMs: 30_000 }, { crawl });
  assert.equal(items.length, 5);
  assert.equal(processedDetails.length, 5);
});
