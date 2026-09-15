import { buildSuccessfulScrapeResult, findConfiguredSite, logger, type BaseScraperConfig, type ScrapedItem, type SiteConfig } from "@rta/shared";
import type { ScraperOptions, ScrapeTimings } from "@rta/scrapers";
import { parseActorInput } from "./input.js";

export interface ActorOutput {
  siteKey: string;
  status: "completed";
  requestedCount: number;
  foundCount: number;
  durationMs: number;
  timings: ScrapeTimings;
  items: ScrapedItem[];
}

export interface ActorDependencies {
  verifyDatabase: () => Promise<void>;
  scrapeSite: (site: SiteConfig, options: ScraperOptions) => Promise<ScrapedItem[]>;
  persistScrapedItems: (site: SiteConfig, items: ScrapedItem[]) => Promise<void>;
}

export async function runActorScrape(input: unknown, config: BaseScraperConfig, dependencies: ActorDependencies): Promise<ActorOutput> {
  const validated = parseActorInput(input, config);
  const site = findConfiguredSite(validated.siteKey, config.sites);
  const timings: ScrapeTimings = {};
  const startedAt = Date.now();

  await dependencies.verifyDatabase();
  const items = await dependencies.scrapeSite(site, {
    userAgent: config.SCRAPER_USER_AGENT,
    delayMs: site.delayMs,
    maxConcurrency: 1,
    limit: validated.limit,
    crawleeMemoryMbytes: config.CRAWLEE_MEMORY_MBYTES,
    navigationTimeoutMs: config.SCRAPE_NAVIGATION_TIMEOUT_MS,
    selectorTimeoutMs: config.SCRAPE_SELECTOR_TIMEOUT_MS,
    jobTimeoutMs: config.SCRAPE_JOB_TIMEOUT_MS,
    timings,
    onStage: (stage) => logger.info({ stage, site: site.key }, "Apify scrape stage"),
  });
  await dependencies.persistScrapedItems(site, items);

  return { siteKey: site.key, ...buildSuccessfulScrapeResult(validated.limit, items.length), durationMs: Date.now() - startedAt, timings, items };
}
