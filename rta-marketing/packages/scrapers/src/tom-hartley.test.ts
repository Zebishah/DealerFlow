import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SiteConfig } from "@rta/shared";
import { TomHartleySourceContractError, isTomHartleyVehicleDetailUrl, parseTomHartleyDetailHtml, parseTomHartleySitemap } from "./tom-hartley.js";

const site: SiteConfig = { key: "tom-hartley", name: "Tom Hartley", baseUrl: "https://www.tomhartley.com/", engine: "cheerio", itemSelector: "body", titleSelector: "h1", priceSelector: ".price", linkSelector: 'a[href*="/used-car-details/"]', delayMs: 0, maxConcurrency: 1 };
const fixture = (name: string) => readFile(new URL(`./fixtures/tom-hartley/${name}`, import.meta.url), "utf8");

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
