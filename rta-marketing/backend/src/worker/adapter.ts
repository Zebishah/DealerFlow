import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "puppeteer";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters, SourceKey } from "../contracts/scrape.js";
import { workerEnv } from "../config/worker-env.js";
import { AppError } from "../lib/errors.js";
import { getFixtureListings } from "./fixtures.js";

interface LegacyResult {
  cars?: unknown[];
  serverError?: string | null;
}

interface ScraperLimits { maxPages: number; minDelayMs: number; }
type LegacyScraper = (page: Page, url: string, limits: ScraperLimits) => Promise<LegacyResult>;
type UrlBuilder = (filters: ScrapeFilters) => string | null;

const legacyRequire = createRequire(__filename);

function loadLegacyModules(source: SourceKey): { buildUrl: UrlBuilder; scrape: LegacyScraper } {
  const cwd = process.cwd();
  const definitions: Record<SourceKey, { builder: string; scraper: string; exportName: string }> = {
    autotrader: {
      builder: `${cwd}/services/url-builders/autotrader.builder.js`,
      scraper: `${cwd}/services/scrapers/autotrader.scraper.js`,
      exportName: "scrapeAutoTrader",
    },
    autoplanet: {
      builder: `${cwd}/services/url-builders/autoPlanet.builder.js`,
      scraper: `${cwd}/services/scrapers/autoplanet.scraper.js`,
      exportName: "scrapeAutoPlanet",
    },
    humberview: {
      builder: `${cwd}/services/url-builders/humberview.builder.js`,
      scraper: `${cwd}/services/scrapers/humberview.scraper.js`,
      exportName: "scrapeHumberview",
    },
    yorkdalevw: {
      builder: `${cwd}/services/url-builders/yorkdalevw.builder.js`,
      scraper: `${cwd}/services/scrapers/scrapeyorkdale.scrapper.js`,
      exportName: "scrapeYorkdaleVW",
    },
  };
  const definition = definitions[source];
  const builderModule = legacyRequire(definition.builder) as { buildUrl: UrlBuilder };
  const scraperModule = legacyRequire(definition.scraper) as Record<string, LegacyScraper>;
  const scrape = scraperModule[definition.exportName];
  if (!scrape) throw new Error(`Legacy scraper export missing for ${source}`);
  return { buildUrl: builderModule.buildUrl, scrape };
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
  }
  return { year, make, model };
}

export function adaptLegacyListing(source: SourceKey, value: unknown, filters: ScrapeFilters): RawListing {
  if (!value || typeof value !== "object") throw new AppError(422, "INVALID_LISTING", "Source returned a non-object listing");
  const car = value as Record<string, unknown>;
  const title = text(car.title) ?? [car.year, car.make, car.model].map(text).filter(Boolean).join(" ");
  if (!title) throw new AppError(422, "LISTING_TITLE_MISSING", "Source returned a listing without a title");
  const identity = titleParts(title, filters);
  const url = text(car.link) ?? text(car.url);
  if (!url) throw new AppError(422, "LISTING_URL_MISSING", "Source returned a listing without a URL");

  return {
    externalId: stableExternalId(source, car),
    source,
    url,
    title,
    imageUrl: text(car.image),
    vin: text(car.vin),
    stockNumber: text(car.stockNumber),
    make: text(car.make) ?? identity.make,
    model: text(car.model) ?? identity.model,
    trim: text(car.trim),
    year: Number(car.year) || identity.year,
    price: text(car.price),
    odometer: text(car.odometer),
    currency: "CAD",
    dealerName: text(car.dealer),
    location: text(car.location) ?? text(car.proximity),
    bodyStyle: text(car.bodyStyle),
    transmission: text(car.transmission),
    drivetrain: text(car.drivetrain),
    engine: text(car.engine),
    exteriorColor: text(car.color),
    condition: car.isUsed === false ? "new" : "used",
  };
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

  const modules = loadLegacyModules(source);
  const url = modules.buildUrl(filters);
  if (!url) return [];

  const puppeteer = (await import("puppeteer")).default;
  const launchOptions = {
    headless: workerEnv.BROWSER_HEADLESS,
    args: [
      "--disable-dev-shm-usage",
      ...(workerEnv.BROWSER_DISABLE_SANDBOX ? ["--no-sandbox", "--disable-setuid-sandbox"] : []),
    ],
    ...(workerEnv.BROWSER_EXECUTABLE_PATH
      ? { executablePath: workerEnv.BROWSER_EXECUTABLE_PATH }
      : {}),
  };
  const browser = await puppeteer.launch(launchOptions);
  let page: Page | undefined;
  let timeout: NodeJS.Timeout | undefined;
  try {
    page = await browser.newPage();
    page.setDefaultTimeout(workerEnv.BROWSER_NAVIGATION_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(workerEnv.BROWSER_NAVIGATION_TIMEOUT_MS);
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-CA,en;q=0.9" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: workerEnv.BROWSER_NAVIGATION_TIMEOUT_MS });
    const minimumDelayMs = Math.max(sourceMinimumDelayMs, workerEnv.SOURCE_MIN_DELAY_MS);
    await new Promise((resolve) => setTimeout(resolve, minimumDelayMs));
    const deadline = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new AppError(504, "SCRAPE_TIMEOUT", `${source} exceeded its job timeout`)), workerEnv.SCRAPE_JOB_TIMEOUT_MS);
    });
    const result = await Promise.race([modules.scrape(page, url, { maxPages: workerEnv.SCRAPE_MAX_PAGES_PER_SOURCE, minDelayMs: minimumDelayMs }), deadline]);
    if (result.serverError) throw new AppError(502, "SOURCE_FAILURE", `${source} could not be acquired`);
    return (result.cars ?? [])
      .slice(0, workerEnv.SCRAPE_MAX_LISTINGS_PER_SOURCE)
      .map((car) => adaptLegacyListing(source, car, filters));
  } catch (error) {
    if (page && workerEnv.SCRAPE_SCREENSHOT_ON_ERROR) {
      await mkdir(workerEnv.SCRAPE_ARTIFACT_DIR, { recursive: true });
      const filename = `${source}-${Date.now()}.png`;
      const screenshotPath = join(workerEnv.SCRAPE_ARTIFACT_DIR, filename) as `${string}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    await browser.close();
  }
}
