import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SiteConfig } from "@rta/shared";
import type { CheerioPage } from "./cheerio-runtime.js";
import type { ScraperOptions } from "./common.js";
import { scrapeRedlineSpecialistCars, RedlineSourceContractError, isRedlineVehicleCategoryUrl, parseRedlineCarsPageHtml, parseRedlineCategoryHtml, parseRedlineSitemap, parseRedlineSitemapIndex } from "./redline-specialist-cars.js";

const site: SiteConfig = { key: "redline-specialist-cars", name: "Redline Specialist Cars", baseUrl: "https://redlinespecialistcars.co.uk/", engine: "cheerio", itemSelector: ".col-md-4[data-at-price][data-at-year][data-at-mileage]", titleSelector: ".product-content h4", priceSelector: ".price", linkSelector: ".item-link", delayMs: 0, maxConcurrency: 1 };
const fixture = (name: string) => readFile(new URL(`./fixtures/redline-specialist-cars/${name}`, import.meta.url), "utf8");

test("Redline discovery follows only confirmed vehicle category paths", async () => {
  const urls = parseRedlineSitemap(await fixture("sitemap.xml"), site);
  assert.deepEqual(urls, ["https://redlinespecialistcars.co.uk/lamborghini-cars-for-sale/", "https://redlinespecialistcars.co.uk/ferrari-cars-for-sale/"]);
  assert.equal(isRedlineVehicleCategoryUrl(urls[0]!), true);
  assert.equal(isRedlineVehicleCategoryUrl("https://redlinespecialistcars.co.uk/cars/"), false);
});

test("Redline /cars/ discovery finds public categories and pagination without requiring cards", async () => {
  const discovery = parseRedlineCarsPageHtml(await fixture("cars.html"), site, "https://redlinespecialistcars.co.uk/cars/", 5);
  assert.equal(discovery.items.length, 0);
  assert.equal(discovery.categoryUrls.length, 6);
  assert.equal(discovery.paginationUrls[0], "https://redlinespecialistcars.co.uk/cars/page/2/");
  assert.equal(discovery.validEmptyState, true);
});

test("Redline sitemap fallback follows only the relevant page sitemap", () => {
  const urls = parseRedlineSitemapIndex("<sitemapindex><sitemap><loc>https://redlinespecialistcars.co.uk/page-sitemap.xml</loc></sitemap><sitemap><loc>https://redlinespecialistcars.co.uk/car-sitemap1.xml</loc></sitemap><sitemap><loc>https://redlinespecialistcars.co.uk/news-sitemap.xml</loc></sitemap></sitemapindex>", site);
  assert.deepEqual(urls, ["https://redlinespecialistcars.co.uk/page-sitemap.xml"]);
});

test("Redline extracts data attributes, card text, background images, and deduplicates", async () => {
  const items = parseRedlineCategoryHtml(await fixture("category.html"), site, "https://redlinespecialistcars.co.uk/ferrari-cars-for-sale/", 10);
  assert.equal(items.length, 2);
  assert.equal(items[0]?.price, "£249,950");
  assert.equal(items[0]?.year, "2022");
  assert.equal(items[0]?.mileage, "3,100 miles");
  assert.equal(items[0]?.thumbnailUrl, "https://redlinespecialistcars.co.uk/images/sf90.jpg");
  assert.equal(items[1]?.thumbnailUrl, "https://images.example.test/huracan.jpg");
  assert.equal(new Set(items.map((item) => item.listingUrl)).size, 2);
  assert.match(String(items[0]?.rawData.sourceText), /2022 Ferrari SF90/);
});

test("Redline limit stops extraction and broken markup throws", async () => {
  assert.equal(parseRedlineCategoryHtml(await fixture("category.html"), site, "https://redlinespecialistcars.co.uk/ferrari-cars-for-sale/", 1).length, 1);
  assert.deepEqual(parseRedlineCategoryHtml(await fixture("empty.html"), site, "https://redlinespecialistcars.co.uk/ferrari-cars-for-sale/", 5), []);
  const unexpected = await fixture("unexpected.html");
  assert.throws(() => parseRedlineCategoryHtml(unexpected, site, "https://redlinespecialistcars.co.uk/ferrari-cars-for-sale/", 5), (error: unknown) => error instanceof RedlineSourceContractError);
});

test("Redline runtime processes discovered categories and stops at five", async () => {
  const inventoryUrl = "https://redlinespecialistcars.co.uk/cars/";
  const inventory = await fixture("cars.html");
  const processedCategories: string[] = [];
  const crawl = async (_site: SiteConfig, _options: ScraperOptions, initialUrls: string[], _maxRequests: number, onPage: (page: CheerioPage) => Promise<void>): Promise<void> => {
    const pending = [...initialUrls];
    while (pending.length > 0) {
      const requestUrl = pending.shift()!;
      const isInventory = requestUrl === inventoryUrl;
      if (!isInventory) processedCategories.push(requestUrl);
      const index = processedCategories.length;
      const body = isInventory ? inventory : `<html><body><div class="col-md-4" data-at-price="100000" data-at-year="2022" data-at-mileage="1000"><div class="product-card"><a class="item-link" href="/cars/${index}/"><div class="product-content"><h4>Test Ferrari ${index}</h4><span class="price">£100,000</span></div><div class="product-card-img" style="background-image: url('/images/test.jpg')"></div></a></div></div></body></html>`;
      await onPage({ body, requestUrl, finalUrl: requestUrl, statusCode: 200, addUrl: async (url) => { pending.push(url); } });
    }
  };
  const items = await scrapeRedlineSpecialistCars(site, { userAgent: "RTA-Local-Redline/1.0", delayMs: 0, maxConcurrency: 1, limit: 5, crawleeMemoryMbytes: 128, navigationTimeoutMs: 10_000, selectorTimeoutMs: 2_000, jobTimeoutMs: 30_000 }, { crawl });
  assert.equal(items.length, 5);
  assert.equal(processedCategories.length, 5);
});
