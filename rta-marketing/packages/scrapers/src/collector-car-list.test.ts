import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCollectorCarListHtml } from "./collector-car-list.js";
import type { SiteConfig } from "@rta/shared";

const site: SiteConfig = {
  key: "collector-car-list",
  name: "CollectorCarList",
  baseUrl: "https://collectorcarlist.com/",
  engine: "cheerio",
  itemSelector: "[data-listing-card]",
  titleSelector: "[data-listing-title]",
  priceSelector: "[data-listing-price]",
  linkSelector: "[data-listing-link]",
  delayMs: 0,
  maxConcurrency: 1,
};

test("CollectorCarList parser extracts normalized fields, lazy/srcset images, POR, and relative URLs", async () => {
  const html = await readFile(new URL("./fixtures/collector-car-list/listings.html", import.meta.url), "utf8");
  const items = parseCollectorCarListHtml(html, site, site.baseUrl, 10);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    title: "Aston Martin DB5",
    price: "CHF 125,000",
    year: "1964",
    mileage: "42,000 miles",
    city: "Geneva, Switzerland",
    listingUrl: "https://collectorcarlist.com/cars/aston-martin-db5-001",
    thumbnailUrl: "https://collectorcarlist.com/images/db5.jpg",
    rawData: {
      source: site.baseUrl,
      sourceKey: site.key,
      listingId: "ccl-001",
      title: "Aston Martin DB5",
      price: "CHF 125,000",
      year: "1964",
      mileage: "42,000 miles",
      city: "Geneva, Switzerland",
      listingUrl: "https://collectorcarlist.com/cars/aston-martin-db5-001",
      thumbnailUrl: "https://collectorcarlist.com/images/db5.jpg",
    },
  });
  assert.equal(items[1]?.price, "Price on request");
  assert.equal(items[1]?.mileage, null);
  assert.equal(items[1]?.thumbnailUrl, "https://images.example.test/ferrari.jpg");
});

test("CollectorCarList parser respects the maximum and returns fewer results without retry semantics", async () => {
  const html = await readFile(new URL("./fixtures/collector-car-list/listings.html", import.meta.url), "utf8");
  assert.equal(parseCollectorCarListHtml(html, site, site.baseUrl, 1).length, 1);
  assert.equal(parseCollectorCarListHtml(html, site, site.baseUrl, 5).length, 3);
});

test("normal empty and malformed pages return zero items", () => {
  assert.deepEqual(parseCollectorCarListHtml("<html><body><p>No listings today</p></body></html>", site, site.baseUrl, 5), []);
  assert.deepEqual(parseCollectorCarListHtml("<article data-listing-card><h2 data-listing-title>Missing URL</h2></article>", site, site.baseUrl, 5), []);
});
