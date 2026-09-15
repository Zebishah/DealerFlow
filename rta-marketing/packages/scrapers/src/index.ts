import { scrapePakWheels } from "./pakwheels.js";
import { scrapeOlxPakistan } from "./olx.js";
import { scrapeSyntheticSource } from "./mock-source.js";
import { scrapeCollectorCarList, parseCollectorCarListHtml } from "./collector-car-list.js";
import type { ScrapedItem, SiteConfig } from "@rta/shared";
import type { ScraperOptions } from "./common.js";

export type { ScrapeStage, ScrapeTimings, ScraperOptions } from "./common.js";
export { scrapePakWheels } from "./pakwheels.js";
export { scrapeOlxPakistan } from "./olx.js";
export { scrapeSyntheticSource } from "./mock-source.js";
export { scrapeCollectorCarList, parseCollectorCarListHtml } from "./collector-car-list.js";

export async function scrapeSite(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
  switch (site.key) {
    case "pakwheels":
      return scrapePakWheels(site, options);
    case "olx-pakistan":
      return scrapeOlxPakistan(site, options);
    case "demo-synthetic":
      return scrapeSyntheticSource(site, options);
    case "collector-car-list":
      return scrapeCollectorCarList(site, options);
    default:
      throw new Error(`No scraper adapter registered for site key: ${site.key}`);
  }
}
