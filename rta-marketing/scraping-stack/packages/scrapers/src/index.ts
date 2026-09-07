import { scrapePakWheels } from "./pakwheels.js";
import { scrapeOlxPakistan } from "./olx.js";
import { scrapeSyntheticSource } from "./mock-source.js";
import type { ScrapedItem, SiteConfig } from "@rta/shared";
import type { ScraperOptions } from "./common.js";

export type { ScraperOptions } from "./common.js";
export { scrapePakWheels } from "./pakwheels.js";
export { scrapeOlxPakistan } from "./olx.js";
export { scrapeSyntheticSource } from "./mock-source.js";

export async function scrapeSite(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
  switch (site.key) {
    case "pakwheels":
      return scrapePakWheels(site, options);
    case "olx-pakistan":
      return scrapeOlxPakistan(site, options);
    case "demo-synthetic":
      return scrapeSyntheticSource(site, options);
    default:
      throw new Error(`No scraper adapter registered for site key: ${site.key}`);
  }
}
