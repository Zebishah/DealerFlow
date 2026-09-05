import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters, SourceKey } from "../contracts/scrape.js";
import { scrapeAutoPlanet } from "./autoplanet.js";
import { scrapeAutoTrader } from "./autotrader.js";
import type { ScraperLimits } from "./common.js";
import { scrapeHumberview } from "./humberview.js";
import { scrapeYorkdaleVolkswagen } from "./yorkdalevw.js";

type SourceScraper = (
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
) => Promise<RawListing[]>;

const scrapers: Record<SourceKey, SourceScraper> = {
  autoplanet: scrapeAutoPlanet,
  autotrader: scrapeAutoTrader,
  humberview: scrapeHumberview,
  yorkdalevw: scrapeYorkdaleVolkswagen,
};

export function scraperFor(source: SourceKey): SourceScraper {
  return scrapers[source];
}
