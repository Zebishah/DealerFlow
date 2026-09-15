import { CheerioCrawler, RequestQueue } from "crawlee";
import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { ScrapedItem, SiteConfig } from "@rta/shared";
import {
  absoluteUrl,
  assertRobotsAllowed,
  imageUrlFromCandidates,
  recordScrapeTiming,
  reportScrapeStage,
  runCrawlerWithTimeout,
  validateItem,
  wait,
  type ScraperOptions,
} from "./common.js";

const CARD_SELECTOR = "[data-listing-card], [data-vehicle-card], article.vehicle-card, article.listing-card";

function cleanText(value: string | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function firstText(card: ReturnType<CheerioAPI>, selectors: string): string | null {
  return cleanText(card.find(selectors).first().text());
}

function firstHref(card: ReturnType<CheerioAPI>, selectors: string, baseUrl: string): string | null {
  return absoluteUrl(card.find(selectors).first().attr("href"), baseUrl);
}

/**
 * Parse the public CollectorCarList card contract without making a network
 * request. The selector fallbacks tolerate harmless markup changes while the
 * required title and stable listing URL prevent malformed cards being stored.
 */
export function parseCollectorCarListHtml(html: string, site: SiteConfig, sourceUrl: string, limit: number): ScrapedItem[] {
  const $ = load(html);
  const items: ScrapedItem[] = [];
  const seenUrls = new Set<string>();
  const cards = $(CARD_SELECTOR).length ? $(CARD_SELECTOR) : $("article");

  cards.each((_index, element) => {
    if (items.length >= limit) return false;
    const card = $(element);
    const listingUrl = firstHref(card, "a[data-listing-link], a[data-vehicle-link], a[href]", site.baseUrl);
    const title = firstText(card, "[data-listing-title], [data-vehicle-title], h2, h3, .listing-title");
    if (!title || !listingUrl || seenUrls.has(listingUrl)) return;
    seenUrls.add(listingUrl);

    const price = firstText(card, "[data-listing-price], [data-vehicle-price], .price");
    const mileage = firstText(card, "[data-listing-mileage], [data-vehicle-mileage], .mileage, .miles");
    const year = firstText(card, "[data-listing-year], [data-vehicle-year], .year");
    const city = firstText(card, "[data-listing-location], [data-vehicle-location], .location, .city");
    const image = card.find("img").first();
    const thumbnailUrl = imageUrlFromCandidates([
      image.attr("data-src"),
      image.attr("data-lazy-src"),
      image.attr("data-original"),
      image.attr("data-image"),
      image.attr("data-srcset"),
      image.attr("srcset"),
      image.attr("src"),
    ], site.baseUrl);

    const item = validateItem(site, {
      title,
      // Preserve “Price on request” and other source text. Never invent a
      // numeric value when a seller has not published a price.
      price,
      year,
      mileage,
      city,
      listingUrl,
      thumbnailUrl,
      rawData: {
        source: sourceUrl,
        sourceKey: site.key,
        listingId: card.attr("data-listing-id") ?? null,
        title,
        price,
        year,
        mileage,
        city,
        listingUrl,
        thumbnailUrl,
      },
    });
    if (item) items.push(item);
    return;
  });

  return items;
}

export async function scrapeCollectorCarList(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
  const totalStartedAt = Date.now();
  const robotsStartedAt = Date.now();
  await reportScrapeStage(options, "checking-source");
  await assertRobotsAllowed(site, options.userAgent);
  recordScrapeTiming(options, "robotsCheckMs", robotsStartedAt);

  const delayStartedAt = Date.now();
  await reportScrapeStage(options, "configured-delay");
  await wait(options.delayMs);
  recordScrapeTiming(options, "configuredDelayMs", delayStartedAt);

  const items: ScrapedItem[] = [];
  const requestQueue = await RequestQueue.open(`rta-${site.key}-${Date.now()}`);
  const crawler = new CheerioCrawler({
    maxConcurrency: 1,
    requestQueue,
    maxRequestRetries: 1,
    requestHandlerTimeoutSecs: Math.ceil(options.jobTimeoutMs / 1000),
    maxRequestsPerCrawl: 1,
    preNavigationHooks: [async (_context, gotOptions) => {
      gotOptions.headers = {
        ...gotOptions.headers,
        "user-agent": options.userAgent,
        "accept-language": "en-US,en;q=0.8",
      };
    }],
    requestHandler: async ({ body, request }) => {
      await reportScrapeStage(options, "extracting");
      const extractionStartedAt = Date.now();
      items.push(...parseCollectorCarListHtml(String(body), site, request.url, options.limit));
      recordScrapeTiming(options, "extractionMs", extractionStartedAt);
    },
  });

  await reportScrapeStage(options, "loading-page");
  const navigationStartedAt = Date.now();
  try {
    await runCrawlerWithTimeout(crawler, site.baseUrl, options.jobTimeoutMs);
  } finally {
    recordScrapeTiming(options, "navigationMs", navigationStartedAt);
    await requestQueue.drop();
    recordScrapeTiming(options, "totalDurationMs", totalStartedAt);
  }
  return items.slice(0, options.limit);
}
