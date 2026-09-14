import { Configuration, PlaywrightCrawler, RequestQueue } from "crawlee";
import { logger } from "@rta/shared";
import { assertRobotsAllowed, absoluteUrl, imageUrlFromCandidates, recordScrapeTiming, reportScrapeStage, runCrawlerWithTimeout, validateItem, wait, type ScraperOptions } from "./common.js";
import type { ScrapedItem, SiteConfig } from "@rta/shared";

export const PLAYWRIGHT_MIN_CONCURRENCY = 1;
export const PLAYWRIGHT_MAX_CONCURRENCY = 1;
export const PLAYWRIGHT_MAX_OPEN_PAGES_PER_BROWSER = 1;

export async function scrapeOlxPakistan(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
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
  const crawleeConfiguration = new Configuration({ memoryMbytes: options.crawleeMemoryMbytes });
  let crawlStartedAt = 0;
  let navigationStartedAt = 0;
  logger.info({
    site: site.name,
    minConcurrency: PLAYWRIGHT_MIN_CONCURRENCY,
    maxConcurrency: PLAYWRIGHT_MAX_CONCURRENCY,
    maxOpenPagesPerBrowser: PLAYWRIGHT_MAX_OPEN_PAGES_PER_BROWSER,
    memoryMbytes: options.crawleeMemoryMbytes,
  }, "starting Playwright crawler");
  const crawler = new PlaywrightCrawler({
    minConcurrency: PLAYWRIGHT_MIN_CONCURRENCY,
    maxConcurrency: PLAYWRIGHT_MAX_CONCURRENCY,
    requestQueue,
    maxRequestRetries: 1,
    requestHandlerTimeoutSecs: Math.ceil(options.jobTimeoutMs / 1000),
    maxRequestsPerCrawl: 1,
    browserPoolOptions: { maxOpenPagesPerBrowser: PLAYWRIGHT_MAX_OPEN_PAGES_PER_BROWSER },
    launchContext: {
      userAgent: options.userAgent,
      launchOptions: {
        headless: true,
        timeout: options.navigationTimeoutMs,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      },
    },
    preNavigationHooks: [async ({ page }) => {
      const browserStartedAt = crawlStartedAt;
      if (browserStartedAt) recordScrapeTiming(options, "browserLaunchMs", browserStartedAt);
      await page.setViewportSize({ width: 1440, height: 900 });
      page.setDefaultNavigationTimeout(options.navigationTimeoutMs);
      page.setDefaultTimeout(options.selectorTimeoutMs);
      await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.8" });
      await page.route("**/*", async (route) => {
        const resourceType = route.request().resourceType();
        if (["image", "media", "font"].includes(resourceType)) {
          await route.abort();
          return;
        }
        await route.continue();
      });
      navigationStartedAt = Date.now();
    }],
    requestHandler: async ({ page, request }) => {
      if (navigationStartedAt) recordScrapeTiming(options, "navigationMs", navigationStartedAt);
      const selectorStartedAt = Date.now();
      let noResultsPage = false;
      try {
        await page.waitForSelector("article", { state: "attached", timeout: options.selectorTimeoutMs });
      } catch (error) {
        const bodyText = await page.locator("body").innerText().catch(() => "");
        noResultsPage = /no results|no listings|no ads|nothing found|try another search/i.test(bodyText);
        if (!noResultsPage) throw error;
      }
      recordScrapeTiming(options, "selectorWaitMs", selectorStartedAt);
      await reportScrapeStage(options, "extracting");
      if (noResultsPage) return;
      const collectVisible = async (): Promise<number> => {
        const beforeCount = items.length;
        const extractionStartedAt = Date.now();
        const extracted = await page.$$eval("article", (cards) => cards.map((card) => {
          const textFromAria = (label: string) => Array.from(card.querySelectorAll("[aria-label]"))
            .find((node) => node.getAttribute("aria-label") === label)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
          const lines = (card.textContent ?? "").split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
          const title = textFromAria("Title") || card.querySelector("h2")?.textContent?.replace(/\s+/g, " ").trim() || "";
          const price = textFromAria("Price") || lines.find((line) => line.startsWith("Rs ")) || null;
          const year = textFromAria("Year") || null;
          const mileage = textFromAria("Mileage") || null;
          const location = textFromAria("Location") || lines.find((line) => line.includes(",") && !line.startsWith("Rs ") && !line.includes("•")) || null;
          const link = Array.from(card.querySelectorAll("a"))
            .find((anchor) => (anchor.getAttribute("href") ?? "").includes("/item/"))?.getAttribute("href") ?? "";
          const image = Array.from(card.querySelectorAll("img"))
            .find((candidate) => ["Cover Photo", "Cover photo"].includes(candidate.getAttribute("aria-label") ?? ""))
            ?? card.querySelector("img");
          return {
            title,
            price,
            year,
            mileage,
            city: location,
            listingUrl: link,
            thumbnailCandidates: image ? [
              image.getAttribute("data-src"),
              image.getAttribute("data-lazy-src"),
              image.getAttribute("data-original"),
              image.getAttribute("data-srcset"),
              image.getAttribute("srcset"),
              image.getAttribute("src"),
            ] : [],
          };
        }));
        for (const value of extracted) {
          if (items.length >= options.limit) break;
          const listingUrl = absoluteUrl(value.listingUrl, site.baseUrl);
          const thumbnailUrl = imageUrlFromCandidates(value.thumbnailCandidates ?? [], site.baseUrl);
          if (!value.title || !listingUrl || items.some((item) => item.listingUrl === listingUrl)) continue;
          const item = validateItem(site, {
            title: value.title,
            price: value.price,
            year: value.year,
            mileage: value.mileage,
            city: value.city,
            listingUrl,
            thumbnailUrl,
            rawData: { source: request.url, ...value, listingUrl, thumbnailUrl },
          });
          if (item) items.push(item);
        }
        recordScrapeTiming(options, "extractionMs", extractionStartedAt);
        return items.length - beforeCount;
      };

      await collectVisible();
      for (let scroll = 0; scroll < 2 && items.length < options.limit; scroll += 1) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(options.delayMs);
        if (await collectVisible() === 0) break;
      }
    },
  }, crawleeConfiguration);
  await reportScrapeStage(options, "launching-browser");
  await reportScrapeStage(options, "loading-page");
  crawlStartedAt = Date.now();
  try {
    await runCrawlerWithTimeout(crawler, site.baseUrl, options.jobTimeoutMs);
  } finally {
    if (navigationStartedAt && options.timings?.navigationMs === undefined) recordScrapeTiming(options, "navigationMs", navigationStartedAt);
    await requestQueue.drop();
    recordScrapeTiming(options, "totalDurationMs", totalStartedAt);
  }
  return items;
}
