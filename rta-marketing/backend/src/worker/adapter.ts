<<<<<<< Updated upstream
=======
<<<<<<< HEAD
import { createHash } from "node:crypto";
=======
>>>>>>> 587b15eead1d6b04a3a3062aa8e506cef0d2aab8
>>>>>>> Stashed changes
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { Page } from "puppeteer-core";
import { workerEnv } from "../config/worker-env.js";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters, SourceKey } from "../contracts/scrape.js";
import { AppError } from "../lib/errors.js";
import { scraperFor } from "../scrapers/index.js";
import { launchScraperBrowser } from "./browser.js";
import { getFixtureListings } from "./fixtures.js";
import type { LegacyScraper } from "./legacy-adapter-contract.js";

<<<<<<< Updated upstream
type UrlBuilder = (filters: ScrapeFilters) => string | null;
const legacyRequire = createRequire(__filename);

=======
<<<<<<< HEAD
// These adapters are legacy CommonJS modules. Keep them behind this typed boundary,
// but import them statically so esbuild includes them in the Lambda artifact.
import { buildUrl as buildAutoTraderUrl } from "../../services/url-builders/autotrader.builder.js";
import { buildUrl as buildAutoPlanetUrl } from "../../services/url-builders/autoPlanet.builder.js";
import { buildUrl as buildHumberviewUrl } from "../../services/url-builders/humberview.builder.js";
import { buildUrl as buildYorkdaleUrl } from "../../services/url-builders/yorkdalevw.builder.js";
import { scrapeAutoTrader } from "../../services/scrapers/autotrader.scraper.js";
import { scrapeAutoPlanet } from "../../services/scrapers/autoplanet.scraper.js";
import { scrapeHumberview } from "../../services/scrapers/humberview.scraper.js";
import { scrapeYorkdaleVW } from "../../services/scrapers/scrapeyorkdale.scrapper.js";

type UrlBuilder = (filters: ScrapeFilters) => string | null;

const legacyAdapters: Record<SourceKey, { buildUrl: UrlBuilder; scrape: LegacyScraper }> = {
  autotrader: { buildUrl: buildAutoTraderUrl, scrape: scrapeAutoTrader },
  autoplanet: { buildUrl: buildAutoPlanetUrl, scrape: scrapeAutoPlanet },
  humberview: { buildUrl: buildHumberviewUrl, scrape: scrapeHumberview },
  yorkdalevw: { buildUrl: buildYorkdaleUrl, scrape: scrapeYorkdaleVW },
};

function loadLegacyModules(source: SourceKey): { buildUrl: UrlBuilder; scrape: LegacyScraper } {
  return legacyAdapters[source];
}

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || null;
}

function stableExternalId(source: SourceKey, car: Record<string, unknown>): string {
  const explicit = text(car.adId) ?? text(car.externalId) ?? text(car.vin) ?? text(car.stockNumber);
  if (explicit) return explicit;
  const url = text(car.link) ?? text(car.url);
  if (!url) throw new AppError(422, "LISTING_ID_MISSING", `${source} returned a listing without a stable ID or URL`);
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function titleParts(title: string, filters: ScrapeFilters) {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? Number(yearMatch[0]) : filters.minYear;
  const make = text(filters.make) ?? text(title.replace(/^\d{4}\s+/, "").split(" ")[0]);
  const model = text(filters.model) ?? text(title.replace(/^\d{4}\s+/, "").split(" ").slice(1, 3).join(" "));
  if (!year || !make || !model) {
    throw new AppError(422, "LISTING_IDENTITY_INCOMPLETE", "The source did not provide year, make, and model");
=======
type UrlBuilder = (filters: ScrapeFilters) => string | null;
const legacyRequire = createRequire(__filename);

>>>>>>> Stashed changes
function loadUrlBuilder(source: SourceKey): UrlBuilder {
  const cwd = process.cwd();
  const definitions: Record<SourceKey, string> = {
    autotrader: `${cwd}/services/url-builders/autotrader.builder.js`,
    autoplanet: `${cwd}/services/url-builders/autoPlanet.builder.js`,
    humberview: `${cwd}/services/url-builders/humberview.builder.js`,
    yorkdalevw: `${cwd}/services/url-builders/yorkdalevw.builder.js`,
  };
  const builderModule = legacyRequire(definitions[source]) as { buildUrl?: unknown };
  if (typeof builderModule.buildUrl !== "function") {
    throw new AppError(500, "SOURCE_URL_BUILDER_MISSING", `URL builder missing for ${source}`);
<<<<<<< Updated upstream
=======
>>>>>>> 587b15eead1d6b04a3a3062aa8e506cef0d2aab8
>>>>>>> Stashed changes
  }
  return builderModule.buildUrl as UrlBuilder;
}

export async function acquireListings(
  source: SourceKey,
  mode: "fixture" | "live",
  filters: ScrapeFilters,
  sourceMinimumDelayMs = 0,
): Promise<RawListing[]> {
  if (mode === "fixture") return getFixtureListings(source);
  if (!workerEnv.LIVE_SCRAPING_ENABLED) {
    throw new AppError(403, "LIVE_SCRAPING_DISABLED", "This worker does not permit live scraping");
  }
  const url = loadUrlBuilder(source)(filters);
  if (!url) {
    throw new AppError(422, "SOURCE_FILTERS_UNSUPPORTED", `${source} cannot represent these filters`, {
      retryable: false,
    });
  }

  const browser = await launchScraperBrowser();
  let page: Page | undefined;
  let timeout: NodeJS.Timeout | undefined;
  try {
    page = await browser.newPage();
    page.setDefaultTimeout(workerEnv.BROWSER_NAVIGATION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(workerEnv.BROWSER_NAVIGATION_TIMEOUT_MS);
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-CA,en;q=0.9" });
    const navigation = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: workerEnv.BROWSER_NAVIGATION_TIMEOUT_MS,
    });
    if (!navigation || navigation.status() >= 500) {
      throw new AppError(502, "SOURCE_NAVIGATION_FAILED", `${source} returned an invalid navigation response`, {
        retryable: true,
        status: navigation?.status() ?? null,
      });
    }
    const minimumDelayMs = Math.max(sourceMinimumDelayMs, workerEnv.SOURCE_MIN_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, minimumDelayMs));
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(
        () => reject(new AppError(504, "SCRAPE_TIMEOUT", `${source} exceeded its job timeout`, { retryable: true })),
        workerEnv.SCRAPE_JOB_TIMEOUT_MS,
      );
    });
    return await Promise.race([
      scraperFor(source)(page, url, filters, {
        maxPages: workerEnv.SCRAPE_MAX_PAGES_PER_SOURCE,
        maxListings: workerEnv.SCRAPE_MAX_LISTINGS_PER_SOURCE,
        minDelayMs: minimumDelayMs,
        timeoutMs: workerEnv.BROWSER_NAVIGATION_TIMEOUT_MS,
      }),
      deadline,
    ]);
  } catch (error) {
    if (page && workerEnv.SCRAPE_SCREENSHOT_ON_ERROR) {
      await mkdir(workerEnv.SCRAPE_ARTIFACT_DIR, { recursive: true });
      const screenshotPath = join(
        workerEnv.SCRAPE_ARTIFACT_DIR,
        `${source}-${Date.now()}.png`,
      ) as `${string}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    await browser.close();
  }
}
