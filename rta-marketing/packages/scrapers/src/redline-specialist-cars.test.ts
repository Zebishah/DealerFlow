import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SiteConfig } from "@rta/shared";
import { RedlineSourceContractError, isRedlineVehicleCategoryUrl, parseRedlineCategoryHtml, parseRedlineSitemap } from "./redline-specialist-cars.js";

const site: SiteConfig = { key: "redline-specialist-cars", name: "Redline Specialist Cars", baseUrl: "https://redlinespecialistcars.co.uk/", engine: "cheerio", itemSelector: ".col-md-4[data-at-price][data-at-year][data-at-mileage]", titleSelector: ".product-content h4", priceSelector: ".price", linkSelector: ".item-link", delayMs: 0, maxConcurrency: 1 };
const fixture = (name: string) => readFile(new URL(`./fixtures/redline-specialist-cars/${name}`, import.meta.url), "utf8");

test("Redline discovery follows only confirmed vehicle category paths", async () => {
  const urls = parseRedlineSitemap(await fixture("sitemap.xml"), site);
  assert.deepEqual(urls, ["https://redlinespecialistcars.co.uk/lamborghini-cars-for-sale/", "https://redlinespecialistcars.co.uk/ferrari-cars-for-sale/"]);
  assert.equal(isRedlineVehicleCategoryUrl(urls[0]!), true);
  assert.equal(isRedlineVehicleCategoryUrl("https://redlinespecialistcars.co.uk/cars/"), false);
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
