import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { logger, type ScrapedItem, type SiteConfig } from "@rta/shared";
import { crawlCheerioUrls } from "./cheerio-runtime.js";
import {
  canonicalUrl,
  cleanText,
  imageUrlFromCandidates,
  recordScrapeTiming,
  reportScrapeStage,
  validateItem,
  wait,
  type ScraperOptions,
} from "./common.js";

const CARD_SELECTOR = ".vehicle--teaser[data-vehicle]";
const ANTI_BOT_MARKERS = ["captcha", "access denied", "verify you are human", "cloudflare", "akamai", "bot detected", "just a moment"];
const MAX_PAGES = 100;

export interface RomansDiagnostics {
  source: string;
  finalUrl: string;
  statusCode: number | null;
  pageNumber: number;
  pageTitle: string;
  matchedCardCount: number;
  validEmptyState: boolean;
  elapsedMs?: number;
}

export class RomansSourceContractError extends Error {
  constructor(message: string, readonly diagnostics: RomansDiagnostics) {
    super(message);
    this.name = "RomansSourceContractError";
  }
}

function emptyState($: CheerioAPI): boolean {
  return /no (?:vehicles|cars|results)|nothing found|no stock/i.test(cleanText($("body").text()) ?? "");
}

function unexpected(diagnostics: RomansDiagnostics, reason: string): never {
  throw new RomansSourceContractError(`Romans International source contract not detected: ${reason}`, diagnostics);
}

export function romansPageUrl(baseUrl: string, pageNumber: number): string {
  if (pageNumber <= 1) return new URL(baseUrl).href;
  const base = new URL(baseUrl);
  return new URL(`/used/cars/page/${pageNumber}/`, base.origin).href;
}

function text(card: ReturnType<CheerioAPI>, selector: string): string | null {
  return cleanText(card.find(selector).first().text());
}

function sourceContractDiagnostics($: CheerioAPI, sourceUrl: string, finalUrl: string, statusCode: number | null, pageNumber: number, elapsedMs?: number): RomansDiagnostics {
  return {
    source: sourceUrl,
    finalUrl,
    statusCode,
    pageNumber,
    pageTitle: cleanText($("title").first().text())?.slice(0, 200) ?? "",
    matchedCardCount: $(CARD_SELECTOR).length,
    validEmptyState: emptyState($),
    elapsedMs,
  };
}

export function parseRomansInternationalHtml(
  html: string,
  site: SiteConfig,
  sourceUrl: string,
  limit: number,
  context: { finalUrl?: string; statusCode?: number; pageNumber?: number; onDiagnostics?: (value: RomansDiagnostics) => void } = {},
): ScrapedItem[] {
  const startedAt = Date.now();
  const $ = load(html);
  const diagnostics = sourceContractDiagnostics($, sourceUrl, context.finalUrl ?? sourceUrl, context.statusCode ?? null, context.pageNumber ?? 1, Date.now() - startedAt);
  context.onDiagnostics?.(diagnostics);
  const bodyText = ($( "body").text()).toLowerCase();
  if (ANTI_BOT_MARKERS.some((marker) => bodyText.includes(marker))) unexpected(diagnostics, "anti-bot or interstitial page");
  if (diagnostics.statusCode !== null && diagnostics.statusCode >= 400) unexpected(diagnostics, `HTTP ${diagnostics.statusCode}`);
  if (diagnostics.matchedCardCount === 0) {
    if (diagnostics.validEmptyState) return [];
    unexpected(diagnostics, "no vehicle cards or valid empty-inventory state");
  }

  const items: ScrapedItem[] = [];
  const seen = new Set<string>();
  $(CARD_SELECTOR).each((_index, element) => {
    if (items.length >= limit) return false;
    const card = $(element);
    const link = card.find('a[href*="/used/cars/"]').first();
    const listingUrl = canonicalUrl(link.attr("href"), site.baseUrl);
    const title = text(card, ".vehicle__title");
    const price = text(card, ".vehicle__price");
    const year = text(card, ".technical-data--date .technical-data__value");
    const mileage = text(card, ".technical-data--mileage .technical-data__value");
    const image = card.find("img").first();
    const thumbnailUrl = imageUrlFromCandidates([
      image.attr("src"), image.attr("srcset"), image.attr("data-src"), image.attr("data-srcset"),
    ], site.baseUrl);
    if (!listingUrl || !title || seen.has(listingUrl)) return;
    seen.add(listingUrl);
    const item = validateItem(site, {
      title,
      price,
      year,
      mileage,
      city: null,
      listingUrl,
      thumbnailUrl,
      rawData: {
        source: sourceUrl,
        sourceKey: site.key,
        sourceText: card.text().replace(/\s+/g, " ").trim(),
        title,
        price,
        year,
        mileage,
        listingUrl,
        thumbnailUrl,
      },
    });
    if (item) items.push(item);
  });
  if (items.length === 0) unexpected(diagnostics, "vehicle cards matched but no valid listings were extracted");
  return items;
}

export async function scrapeRomansInternational(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
  const totalStartedAt = Date.now();
  await reportScrapeStage(options, "checking-source");
  const delayStartedAt = Date.now();
  await reportScrapeStage(options, "configured-delay");
  await wait(options.delayMs);
  recordScrapeTiming(options, "configuredDelayMs", delayStartedAt);

  const items: ScrapedItem[] = [];
  const seen = new Set<string>();
  let pageNumber = 1;
  await reportScrapeStage(options, "loading-page");
  const navigationStartedAt = Date.now();
  try {
    await crawlCheerioUrls(site, options, [romansPageUrl(site.baseUrl, 1)], MAX_PAGES, async (page) => {
      if (items.length >= options.limit) return;
      const extractionStartedAt = Date.now();
      await reportScrapeStage(options, "extracting");
      const parsed = parseRomansInternationalHtml(page.body, site, page.requestUrl, options.limit - items.length, {
        finalUrl: page.finalUrl,
        statusCode: page.statusCode ?? undefined,
        pageNumber,
        onDiagnostics: (diagnostics) => logger.info({ site: site.key, ...diagnostics }, "Romans International source contract inspected"),
      });
      for (const item of parsed) {
        if (items.length >= options.limit || seen.has(item.listingUrl)) continue;
        seen.add(item.listingUrl);
        items.push(item);
      }
      recordScrapeTiming(options, "extractionMs", extractionStartedAt);
      if (items.length < options.limit && parsed.length > 0 && pageNumber < MAX_PAGES) {
        pageNumber += 1;
        await page.addUrl(romansPageUrl(site.baseUrl, pageNumber));
      }
    });
  } finally {
    recordScrapeTiming(options, "navigationMs", navigationStartedAt);
    recordScrapeTiming(options, "totalDurationMs", totalStartedAt);
  }
  return items;
}
