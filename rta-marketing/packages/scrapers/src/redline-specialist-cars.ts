import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { logger, type ScrapedItem, type SiteConfig } from "@rta/shared";
import { crawlCheerioUrls, type CheerioPage } from "./cheerio-runtime.js";
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

const CARD_SELECTOR = ".col-md-4[data-at-price][data-at-year][data-at-mileage]";
const CATEGORY_PATH = /^\/[a-z0-9][a-z0-9-]*-cars-for-sale\/$/i;
const MAX_SITEMAP_DOCUMENTS = 5;
const MAX_CATEGORY_URLS = 25;
const ANTI_BOT_MARKERS = ["captcha", "access denied", "verify you are human", "cloudflare", "akamai", "bot detected", "just a moment"];

export interface RedlineDiagnostics {
  source: string;
  finalUrl: string;
  statusCode: number | null;
  categoryUrl?: string;
  pageTitle: string;
  matchedCardCount: number;
  categoryUrlCount: number;
  validEmptyState: boolean;
  elapsedMs?: number;
}

export class RedlineSourceContractError extends Error {
  constructor(message: string, readonly diagnostics: RedlineDiagnostics) {
    super(message);
    this.name = "RedlineSourceContractError";
  }
}

function categoryUrl(value: string | undefined, site: SiteConfig): string | null {
  const url = canonicalUrl(value, site.baseUrl);
  if (!url) return null;
  const parsed = new URL(url);
  return parsed.origin === new URL(site.baseUrl).origin && CATEGORY_PATH.test(parsed.pathname) ? url : null;
}

export function isRedlineVehicleCategoryUrl(value: string, baseUrl = "https://redlinespecialistcars.co.uk/"): boolean {
  return categoryUrl(value, { baseUrl, key: "redline-specialist-cars", name: "Redline Specialist Cars", engine: "cheerio", delayMs: 0, maxConcurrency: 1 } as SiteConfig) !== null;
}

export function parseRedlineSitemap(html: string, site: SiteConfig, sourceUrl = site.baseUrl): string[] {
  const $ = load(html, { xmlMode: true });
  const categories = new Set<string>();
  $("loc").each((_index, element) => {
    const parsed = categoryUrl(cleanText($(element).text()) ?? undefined, site);
    if (parsed) categories.add(parsed);
  });
  if (categories.size === 0) {
    throw new RedlineSourceContractError("Redline Specialist Cars sitemap contract not detected: no confirmed vehicle categories", {
      source: sourceUrl,
      finalUrl: sourceUrl,
      statusCode: null,
      pageTitle: "",
      matchedCardCount: 0,
      categoryUrlCount: 0,
      validEmptyState: false,
    });
  }
  return [...categories].slice(0, MAX_CATEGORY_URLS);
}

function backgroundImageUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;
  const match = value.match(/url\((?:["']?)(.*?)(?:["']?)\)/i);
  return imageUrlFromCandidates([match?.[1]], baseUrl);
}

function diagnostics($: CheerioAPI, sourceUrl: string, page: CheerioPage, categoryUrlValue?: string, elapsedMs?: number): RedlineDiagnostics {
  return {
    source: sourceUrl,
    finalUrl: page.finalUrl,
    statusCode: page.statusCode,
    categoryUrl: categoryUrlValue,
    pageTitle: cleanText($("title").first().text())?.slice(0, 200) ?? "",
    matchedCardCount: $(CARD_SELECTOR).length,
    categoryUrlCount: 0,
    validEmptyState: /no (?:vehicles|cars|results)|nothing found/i.test(cleanText($("body").text()) ?? ""),
    elapsedMs,
  };
}

function unexpected(value: RedlineDiagnostics, reason: string): never {
  throw new RedlineSourceContractError(`Redline Specialist Cars source contract not detected: ${reason}`, value);
}

export function parseRedlineCategoryHtml(
  html: string,
  site: SiteConfig,
  sourceUrl: string,
  limit: number,
  context: { finalUrl?: string; statusCode?: number; onDiagnostics?: (value: RedlineDiagnostics) => void } = {},
): ScrapedItem[] {
  const startedAt = Date.now();
  const $ = load(html);
  const page: CheerioPage = { body: html, requestUrl: sourceUrl, finalUrl: context.finalUrl ?? sourceUrl, statusCode: context.statusCode ?? null, addUrl: async () => undefined };
  const info = diagnostics($, sourceUrl, page, sourceUrl, Date.now() - startedAt);
  context.onDiagnostics?.(info);
  const bodyText = (cleanText($("body").text()) ?? "").toLowerCase();
  if (ANTI_BOT_MARKERS.some((marker) => bodyText.includes(marker))) unexpected(info, "anti-bot or interstitial page");
  if (info.statusCode !== null && info.statusCode >= 400) unexpected(info, `HTTP ${info.statusCode}`);
  if (info.matchedCardCount === 0) {
    if (info.validEmptyState) return [];
    unexpected(info, "no vehicle cards or valid empty-inventory state");
  }

  const items: ScrapedItem[] = [];
  const seen = new Set<string>();
  $(CARD_SELECTOR).each((_index, element) => {
    if (items.length >= limit) return false;
    const card = $(element);
    const link = card.find(".item-link").first();
    const listingUrl = canonicalUrl(link.attr("href"), site.baseUrl);
    const title = cleanText(card.find(".product-content h4").first().text());
    const price = cleanText(card.attr("data-at-price")) ?? cleanText(card.find(".price").first().text());
    const year = cleanText(card.attr("data-at-year"));
    const mileage = cleanText(card.attr("data-at-mileage"));
    const image = card.find(".product-card-img").first();
    const thumbnailUrl = imageUrlFromCandidates([
      image.attr("src"), image.attr("data-src"), image.attr("data-image"),
    ], site.baseUrl) ?? backgroundImageUrl(image.attr("style"), site.baseUrl);
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
  if (items.length === 0) unexpected(info, "vehicle cards matched but no valid listings were extracted");
  return items;
}

export async function scrapeRedlineSpecialistCars(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
  const totalStartedAt = Date.now();
  await reportScrapeStage(options, "checking-source");
  const delayStartedAt = Date.now();
  await reportScrapeStage(options, "configured-delay");
  await wait(options.delayMs);
  recordScrapeTiming(options, "configuredDelayMs", delayStartedAt);
  const sitemapUrl = site.sitemapUrl ?? new URL("/sitemap.xml", site.baseUrl).href;
  const categories: string[] = [];
  const seenCategories = new Set<string>();
  const items: ScrapedItem[] = [];
  const seenItems = new Set<string>();
  let sitemapDocuments = 0;
  let nextCategoryIndex = 0;
  await reportScrapeStage(options, "loading-page");
  const navigationStartedAt = Date.now();
  try {
    await crawlCheerioUrls(site, options, [sitemapUrl], MAX_SITEMAP_DOCUMENTS + MAX_CATEGORY_URLS, async (page: CheerioPage) => {
      const extractionStartedAt = Date.now();
      await reportScrapeStage(options, "extracting");
      if (sitemapDocuments === 0 && /<urlset|<sitemapindex|<loc\b/i.test(page.body)) {
        sitemapDocuments += 1;
        const discovered = parseRedlineSitemap(page.body, site, page.requestUrl);
        for (const url of discovered) {
          if (!seenCategories.has(url)) {
            seenCategories.add(url);
            categories.push(url);
          }
        }
        if (categories.length > 0) await page.addUrl(categories[nextCategoryIndex++]!);
      } else if (items.length < options.limit) {
        const parsed = parseRedlineCategoryHtml(page.body, site, page.requestUrl, options.limit - items.length, {
          finalUrl: page.finalUrl,
          statusCode: page.statusCode ?? undefined,
          onDiagnostics: (value) => logger.info({ site: site.key, ...value }, "Redline Specialist Cars source contract inspected"),
        });
        for (const item of parsed) {
          if (items.length >= options.limit || seenItems.has(item.listingUrl)) continue;
          seenItems.add(item.listingUrl);
          items.push(item);
        }
        if (items.length < options.limit && nextCategoryIndex < categories.length) {
          await page.addUrl(categories[nextCategoryIndex++]!);
        }
      }
      recordScrapeTiming(options, "extractionMs", extractionStartedAt);
    });
  } finally {
    recordScrapeTiming(options, "navigationMs", navigationStartedAt);
    recordScrapeTiming(options, "totalDurationMs", totalStartedAt);
  }
  return items.slice(0, options.limit);
}
