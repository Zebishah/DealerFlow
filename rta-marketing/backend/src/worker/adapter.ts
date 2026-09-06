import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "puppeteer-core";
import { buildUrl as buildAutoPlanetUrl } from "../../services/url-builders/autoPlanet.builder.js";
import { buildUrl as buildAutoTraderUrl } from "../../services/url-builders/autotrader.builder.js";
import { buildUrl as buildHumberviewUrl } from "../../services/url-builders/humberview.builder.js";
import { buildUrl as buildYorkdaleUrl } from "../../services/url-builders/yorkdalevw.builder.js";
import { workerEnv } from "../config/worker-env.js";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters, SourceKey } from "../contracts/scrape.js";
import { AppError } from "../lib/errors.js";
import { scraperFor } from "../scrapers/index.js";
import { launchScraperBrowser } from "./browser.js";
import { getFixtureListings } from "./fixtures.js";

type UrlBuilder = (filters: ScrapeFilters) => string | null;
const urlBuilders: Record<SourceKey, UrlBuilder> = {
  autotrader: buildAutoTraderUrl,
  autoplanet: buildAutoPlanetUrl,
  humberview: buildHumberviewUrl,
  yorkdalevw: buildYorkdaleUrl,
};

function loadUrlBuilder(source: SourceKey): UrlBuilder {
  const builder = urlBuilders[source];
  if (!builder) {
    throw new AppError(500, "SOURCE_URL_BUILDER_MISSING", `URL builder missing for ${source}`);
  }
  return builder;
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
    const navigationStatus = navigation?.status() ?? 0;
    if (navigationStatus === 403) {
      throw new AppError(502, "SOURCE_ACCESS_BLOCKED", `${source} rejected the browser request`, {
        retryable: false,
        status: navigationStatus,
      });
    }
    if (navigationStatus === 429) {
      throw new AppError(429, "SOURCE_RATE_LIMITED", `${source} rate-limited the browser request`, {
        retryable: true,
        status: navigationStatus,
      });
    }
    if (!navigation || navigationStatus >= 500) {
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
