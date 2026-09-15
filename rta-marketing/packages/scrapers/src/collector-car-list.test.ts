import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SiteConfig } from "@rta/shared";
import {
  CollectorCarListSourceContractError,
  parseCollectorCarListHtml,
  type CollectorCarListDiagnostics,
} from "./collector-car-list.js";

const site: SiteConfig = {
  key: "collector-car-list",
  name: "CollectorCarList",
  baseUrl: "https://www.collectorcarlist.com/",
  engine: "cheerio",
  itemSelector: 'a[href^="/listings/"]',
  titleSelector: "h3",
  priceSelector: "div > p",
  linkSelector: 'a[href^="/listings/"]',
  delayMs: 0,
  maxConcurrency: 1,
};

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/collector-car-list/${name}`, import.meta.url), "utf8");
}

test("extracts live-shaped listing cards and their fields", async () => {
  let diagnostics: CollectorCarListDiagnostics | undefined;
  const items = parseCollectorCarListHtml(await fixture("listings.html"), site, site.baseUrl, 5, {
    finalUrl: site.baseUrl,
    statusCode: 200,
    onDiagnostics: (value) => {
      diagnostics = value;
    },
  });

  assert.equal(items.length, 5);
  assert.equal(items[0]?.title, '911 T "RS Pro Touring" 3.6 G50 Patrick Motorsports');
  assert.equal(items[0]?.listingUrl, `${site.baseUrl}listings/1970-porsche-911t-rs-pro-touring-one`);
  assert.equal(items[0]?.price, "$220,000");
  assert.equal(items[0]?.year, "1970");
  assert.equal(items[0]?.mileage, "15,154");
  assert.equal(items[0]?.city, "San Diego, CA");
  assert.match(items[0]?.thumbnailUrl ?? "", /_next\/image/);
  assert.equal(diagnostics?.matchedCardCount, 6);
  assert.equal(diagnostics?.structuredJsonBlockCount, 0);
});

test("deduplicates listing URLs and accepts fewer results than requested", async () => {
  const items = parseCollectorCarListHtml(await fixture("listings.html"), site, site.baseUrl, 10);

  assert.equal(items.length, 5);
  assert.equal(new Set(items.map((item) => item.listingUrl)).size, 5);
});

test("supports lazy image attributes and srcset candidates", async () => {
  const items = parseCollectorCarListHtml(await fixture("listings.html"), site, site.baseUrl, 5);

  assert.equal(items[1]?.thumbnailUrl, "https://images.example.test/ferrari.jpg");
  assert.equal(items[2]?.thumbnailUrl, "https://www.collectorcarlist.com/images/911.jpg");
});

test("treats an explicit empty inventory page as a successful zero-result scrape", async () => {
  let diagnostics: CollectorCarListDiagnostics | undefined;
  const items = parseCollectorCarListHtml(await fixture("empty.html"), site, site.baseUrl, 5, {
    finalUrl: `${site.baseUrl}?make=NoSuchCollectorMake`,
    statusCode: 200,
    onDiagnostics: (value) => {
      diagnostics = value;
    },
  });

  assert.deepEqual(items, []);
  assert.equal(diagnostics?.validEmptyState, true);
  assert.equal(diagnostics?.matchedCardCount, 0);
});

test("rejects unexpected source markup instead of reporting a false empty result", async () => {
  let diagnostics: CollectorCarListDiagnostics | undefined;
  const html = await fixture("unexpected.html");

  assert.throws(
    () =>
      parseCollectorCarListHtml(html, site, site.baseUrl, 5, {
        finalUrl: site.baseUrl,
        statusCode: 200,
        onDiagnostics: (value) => {
          diagnostics = value;
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof CollectorCarListSourceContractError);
      assert.equal(error.diagnostics.matchedCardCount, 0);
      return true;
    },
  );
  assert.equal(diagnostics?.validEmptyState, false);
});
