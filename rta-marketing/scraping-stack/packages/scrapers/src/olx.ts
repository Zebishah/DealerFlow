import { PlaywrightCrawler, RequestQueue } from "crawlee";
import { assertRobotsAllowed, absoluteUrl, validateItem, wait, type ScraperOptions } from "./common.js";
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
    requestHandlerTimeoutSecs: 60,
    maxRequestsPerCrawl: 1,
    launchContext: {
      userAgent: options.userAgent,
      launchOptions: { executablePath: options.chromiumExecutablePath, headless: true },
    },
    preNavigationHooks: [async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.8" });
    }],
    requestHandler: async ({ page, request }) => {
      await page.waitForSelector("article", { state: "attached", timeout: 30_000 });
      for (let scroll = 0; scroll < 2; scroll += 1) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(options.delayMs);
      }
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
        return { title, price, year, mileage, city: location, listingUrl: link, thumbnailUrl: image?.getAttribute("src") ?? image?.getAttribute("srcset") ?? null };
      }));
      for (const value of extracted) {
        const listingUrl = absoluteUrl(value.listingUrl, site.baseUrl);
        const thumbnailUrl = absoluteUrl(value.thumbnailUrl ?? undefined, site.baseUrl);
        if (!value.title || !listingUrl) continue;
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
    },
  });
  try {
    await crawler.run([site.baseUrl]);
  } finally {
    await requestQueue.drop();
  }
  return items;
}
