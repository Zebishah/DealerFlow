import { CheerioCrawler, RequestQueue } from "crawlee";
import { assertRobotsAllowed, absoluteUrl, imageUrlFromCandidates, recordScrapeTiming, reportScrapeStage, runCrawlerWithTimeout, validateItem, wait, type ScraperOptions } from "./common.js";
import type { ScrapedItem, SiteConfig } from "@rta/shared";

export async function scrapePakWheels(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
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
      gotOptions.headers = { ...gotOptions.headers, "user-agent": options.userAgent, "accept-language": "en-US,en;q=0.8" };
    }],
    requestHandler: async ({ $, request }) => {
      await reportScrapeStage(options, "extracting");
      const extractionStartedAt = Date.now();
      $("li.classified-listing").each((_index, element) => {
        if (items.length >= options.limit) return false;
        const card = $(element);
        const titleNode = card.find("a.car-name.ad-detail-path").first();
        const listingUrl = absoluteUrl(titleNode.attr("href"), site.baseUrl);
        const title = titleNode.text().replace(/\s+/g, " ").trim();
        const price = card.find(".price-details").first().text().replace(/\s+/g, " ").trim() || null;
        const year = card.find(".ad-specs i.pw-date").first().parent("li").text().replace(/\s+/g, " ").trim() || null;
        const mileage = card.find(".ad-specs i.pw-mileage").first().parent("li").text().replace(/\s+/g, " ").trim() || null;
        const city = card.find(".search-vehicle-info li").first().text().replace(/\s+/g, " ").trim() || null;
        const image = card.find(".img-box img, img").first();
        const thumbnailUrl = imageUrlFromCandidates([
          image.attr("data-src"),
          image.attr("data-lazy-src"),
          image.attr("data-original"),
          image.attr("data-image"),
          image.attr("data-srcset"),
          image.attr("srcset"),
          image.attr("src"),
        ], site.baseUrl);
        if (!title || !listingUrl) return;
        const item = validateItem(site, {
          title,
          price,
          year,
          mileage,
          city,
          listingUrl,
          thumbnailUrl,
          rawData: { source: request.url, listingId: card.attr("data-listing-id"), title, price, year, mileage, city, listingUrl, thumbnailUrl },
        });
        if (item) items.push(item);
      });
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
  return items;
}
