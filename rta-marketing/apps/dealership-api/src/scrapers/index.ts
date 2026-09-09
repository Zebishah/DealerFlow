import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters, SourceKey } from "../contracts/scrape.js";
import type { ScraperLimits } from "./common.js";
import { scrapePublicInventory } from "./public-inventory.js";

type SourceScraper = (
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
) => Promise<RawListing[]>;

const scrapers: Record<SourceKey, SourceScraper> = {
  autoplanet: scrapePublicInventory,
  autotrader: scrapePublicInventory,
  humberview: scrapePublicInventory,
  yorkdalevw: scrapePublicInventory,
};

export function scraperFor(source: SourceKey): SourceScraper {
  return scrapers[source];
}
