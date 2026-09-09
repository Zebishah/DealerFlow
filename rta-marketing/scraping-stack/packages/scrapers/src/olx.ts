import { PlaywrightCrawler, RequestQueue } from "crawlee";
import { assertRobotsAllowed, absoluteUrl, imageUrlFromCandidates, runCrawlerWithTimeout, validateItem, wait, type ScraperOptions } from "./common.js";
import type { ScrapedItem, SiteConfig } from "@rta/shared";

export async function scrapeOlxPakistan(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
  await assertRobotsAllowed(site, options.userAgent);
  await wait(options.delayMs);
  const items: ScrapedItem[] = [];
  const requestQueue = await RequestQueue.open(`rta-${site.key}-${Date.now()}`);
  const crawler = new PlaywrightCrawler({
    maxConcurrency: 1,
    requestQueue,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: Math.ceil(options.jobTimeoutMs / 1000),
    maxRequestsPerCrawl: 1,
    browserPoolOptions: { maxOpenPagesPerBrowser: 1 },
    launchContext: {
      userAgent: options.userAgent,
      launchOptions: { executablePath: options.chromiumExecutablePath, headless: true, timeout: options.navigationTimeoutMs },
    },
    preNavigationHooks: [async ({ page }) => {
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
    }],
    requestHandler: async ({ page, request }) => {
      await page.waitForSelector("article", { state: "attached", timeout: options.selectorTimeoutMs });
      const collectVisible = async (): Promise<void> => {
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
      };

      await collectVisible();
      for (let scroll = 0; scroll < 2 && items.length < options.limit; scroll += 1) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(options.delayMs);
        await collectVisible();
      }
    },
  });
  try {
    await runCrawlerWithTimeout(crawler, site.baseUrl, options.jobTimeoutMs);
  } finally {
    await requestQueue.drop();
  }
  return items;
}
