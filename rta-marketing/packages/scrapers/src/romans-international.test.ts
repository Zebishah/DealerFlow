import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SiteConfig } from "@rta/shared";
import { RomansSourceContractError, parseRomansInternationalHtml, romansPageUrl } from "./romans-international.js";

const site: SiteConfig = { key: "romans-international", name: "Romans International", baseUrl: "https://www.romansinternational.com/used/cars/", engine: "cheerio", itemSelector: ".vehicle--teaser[data-vehicle]", titleSelector: ".vehicle__title", priceSelector: ".vehicle__price", linkSelector: 'a[href*="/used/cars/"]', delayMs: 0, maxConcurrency: 1 };
const fixture = (name: string) => readFile(new URL(`./fixtures/romans-international/${name}`, import.meta.url), "utf8");

test("Romans extracts five listing cards, fields, source text, and lazy images", async () => {
  const items = parseRomansInternationalHtml(await fixture("listings.html"), site, site.baseUrl, 5);
  assert.equal(items.length, 5);
  assert.deepEqual(items[0] && { title: items[0].title, price: items[0].price, year: items[0].year, mileage: items[0].mileage, listingUrl: items[0].listingUrl, thumbnailUrl: items[0].thumbnailUrl }, {
    title: "2022 Ferrari Roma", price: "£164,950", year: "2022", mileage: "4,201 miles", listingUrl: "https://www.romansinternational.com/used/cars/2022-ferrari-roma/", thumbnailUrl: "https://www.romansinternational.com/images/roma.jpg",
  });
  assert.match(String(items[0]?.rawData.sourceText), /2022 Ferrari Roma/);
  assert.equal(items[1]?.thumbnailUrl, "https://images.example.test/911.jpg");
  assert.equal(items[2]?.thumbnailUrl, "https://images.example.test/mclaren.jpg");
});

test("Romans limit stops extraction and duplicate URLs are removed", async () => {
  const items = parseRomansInternationalHtml(await fixture("listings.html"), site, site.baseUrl, 2);
  assert.equal(items.length, 2);
  const allItems = parseRomansInternationalHtml(await fixture("listings.html"), site, site.baseUrl, 10);
  assert.equal(allItems.length, 5);
  assert.equal(new Set(allItems.map((item) => item.listingUrl)).size, 5);
  assert.equal(romansPageUrl(site.baseUrl, 2), "https://www.romansinternational.com/used/cars/page/2/");
});

test("Romans accepts explicit empty inventory and rejects broken markup", async () => {
  assert.deepEqual(parseRomansInternationalHtml(await fixture("empty.html"), site, site.baseUrl, 5), []);
  assert.throws(() => parseRomansInternationalHtml("<html><body>Welcome</body></html>", site, site.baseUrl, 5), (error: unknown) => error instanceof RomansSourceContractError);
});
