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
const CATEGORY_LINK_SELECTOR = 'a[href*="-cars-for-sale/"]';
const CATEGORY_PATH = /^\/[a-z0-9][a-z0-9-]*-cars-for-sale\/$/i;
const PAGINATION_SELECTOR = ".cars-pagination a[href]";
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
  paginationLinkCount: number;
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
  if ($("sitemapindex").length > 0) return [];
  if (categories.size === 0) {
    throw new RedlineSourceContractError("Redline Specialist Cars sitemap contract not detected: no confirmed vehicle categories", {
      source: sourceUrl,
      finalUrl: sourceUrl,
      statusCode: null,
      pageTitle: "",
      matchedCardCount: 0,
      categoryUrlCount: 0,
      paginationLinkCount: 0,
      validEmptyState: false,
    });
  }
  return [...categories].slice(0, MAX_CATEGORY_URLS);
}

export function parseRedlineSitemapIndex(html: string, site: SiteConfig, sourceUrl = site.baseUrl): string[] {
  const $ = load(html, { xmlMode: true });
  if ($("sitemapindex").length === 0) {
    throw new RedlineSourceContractError("Redline Specialist Cars sitemap contract not detected: expected a sitemap index", {
      source: sourceUrl, finalUrl: sourceUrl, statusCode: null, pageTitle: "", matchedCardCount: 0, categoryUrlCount: 0, paginationLinkCount: 0, validEmptyState: false,
    });
  }
  const origin = new URL(site.baseUrl).origin;
  return [...new Set($("sitemap > loc, sitemapindex > loc, loc").map((_index, element) => cleanText($(element).text())).get().filter((value): value is string => Boolean(value)).map((value) => canonicalUrl(value, site.baseUrl)).filter((value): value is string => Boolean(value)).filter((value) => new URL(value).origin === origin && /\/page-sitemap(?:\d*)\.xml$/i.test(new URL(value).pathname)))].slice(0, MAX_SITEMAP_DOCUMENTS);
}

export interface RedlineInventoryDiscovery {
  items: ScrapedItem[];
  categoryUrls: string[];
  paginationUrls: string[];
  matchedCardCount: number;
  validEmptyState: boolean;
}

function hasValidEmptyState($: CheerioAPI): boolean {
  const visibleText = cleanText(visibleBodyText($)) ?? "";
  const altText = $("[alt]").map((_index, element) => $(element).attr("alt")).get().join(" ");
  return /no (?:vehicles|cars|results)|nothing found/i.test(`${visibleText} ${altText}`);
}

function visibleBodyText($: CheerioAPI): string {
  const body = $("body").clone();
  body.find("script, style, noscript").remove();
  return body.text();
}

function publicPaginationUrls($: CheerioAPI, site: SiteConfig): string[] {
  return [...new Set($(PAGINATION_SELECTOR).map((_index, element) => canonicalUrl($(element).attr("href"), site.baseUrl)).get().filter((value): value is string => Boolean(value)))].slice(0, MAX_CATEGORY_URLS);
}

export function parseRedlineCarsPageHtml(html: string, site: SiteConfig, sourceUrl: string, limit: number, context: { finalUrl?: string; statusCode?: number; onDiagnostics?: (value: RedlineDiagnostics) => void } = {}): RedlineInventoryDiscovery {
  const $ = load(html);
  const categoryUrls = [...new Set($(CATEGORY_LINK_SELECTOR).map((_index, element) => categoryUrl($(element).attr("href"), site)).get().filter((value): value is string => Boolean(value)))].slice(0, MAX_CATEGORY_URLS);
  const paginationUrls = publicPaginationUrls($, site);
  const matchedCardCount = $(CARD_SELECTOR).length;
  const validEmptyState = hasValidEmptyState($);
  if (matchedCardCount > 0) {
    const items = parseRedlineCategoryHtml(html, site, sourceUrl, limit, context);
    return { items, categoryUrls, paginationUrls, matchedCardCount, validEmptyState };
  }
  const info: RedlineDiagnostics = {
    source: sourceUrl,
    finalUrl: context.finalUrl ?? sourceUrl,
    statusCode: context.statusCode ?? null,
    pageTitle: cleanText($("title").first().text())?.slice(0, 200) ?? "",
    matchedCardCount,
    categoryUrlCount: categoryUrls.length,
    paginationLinkCount: paginationUrls.length,
    validEmptyState,
  };
  context.onDiagnostics?.(info);
  if (ANTI_BOT_MARKERS.some((marker) => (cleanText(visibleBodyText($)) ?? "").toLowerCase().includes(marker))) unexpected(info, "anti-bot or interstitial page");
  if (!validEmptyState && categoryUrls.length === 0) unexpected(info, "inventory page has no vehicle cards, public category links, or valid empty-inventory state");
  return { items: [], categoryUrls, paginationUrls, matchedCardCount, validEmptyState };
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
    paginationLinkCount: $(PAGINATION_SELECTOR).length,
    validEmptyState: hasValidEmptyState($),
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
  const bodyText = (cleanText(visibleBodyText($)) ?? "").toLowerCase();
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
    const price = cleanText(card.find(".price").first().text()) ?? cleanText(card.attr("data-at-price"));
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

export async function scrapeRedlineSpecialistCars(site: SiteConfig, options: ScraperOptions, dependencies: { crawl?: typeof crawlCheerioUrls } = {}): Promise<ScrapedItem[]> {
  const totalStartedAt = Date.now();
  await reportScrapeStage(options, "checking-source");
  const delayStartedAt = Date.now();
  await reportScrapeStage(options, "configured-delay");
  await wait(options.delayMs);
  recordScrapeTiming(options, "configuredDelayMs", delayStartedAt);
  const inventoryUrl = new URL("/cars/", site.baseUrl).href;
  const sitemapUrl = site.sitemapUrl ?? new URL("/sitemap.xml", site.baseUrl).href;
  const categories: string[] = [];
  const seenCategories = new Set<string>();
  const seenPages = new Set<string>([inventoryUrl]);
  const items: ScrapedItem[] = [];
  const seenItems = new Set<string>();
  let nextCategoryIndex = 0;
  let processedCategoryPages = 0;
  let validEmptyInventory = false;
  let inventoryPageProcessed = false;
  let sitemapFallback = false;
  const sitemapUrls = new Set<string>();
  await reportScrapeStage(options, "loading-page");
  const navigationStartedAt = Date.now();
  try {
    await (dependencies.crawl ?? crawlCheerioUrls)(site, options, [inventoryUrl], MAX_SITEMAP_DOCUMENTS + MAX_CATEGORY_URLS + 1, async (page: CheerioPage) => {
      const extractionStartedAt = Date.now();
      await reportScrapeStage(options, "extracting");
      if (!inventoryPageProcessed && page.requestUrl === inventoryUrl) {
        inventoryPageProcessed = true;
        const discovery = parseRedlineCarsPageHtml(page.body, site, page.requestUrl, options.limit, {
          finalUrl: page.finalUrl,
          statusCode: page.statusCode ?? undefined,
          onDiagnostics: (value) => logger.info({ site: site.key, ...value }, "Redline inventory contract inspected"),
        });
        logger.info({ site: site.key, inventoryUrl: page.requestUrl, categoryUrlCount: discovery.categoryUrls.length, firstDiscoveredCategories: discovery.categoryUrls.slice(0, 3), paginationLinkCount: discovery.paginationUrls.length, matchedCardCount: discovery.matchedCardCount, extractedItemCount: discovery.items.length }, "Redline inventory discovery completed");
        for (const url of discovery.categoryUrls) {
          if (!seenCategories.has(url)) {
            seenCategories.add(url);
            categories.push(url);
          }
        }
        for (const item of discovery.items) {
          if (items.length >= options.limit || seenItems.has(item.listingUrl)) continue;
          seenItems.add(item.listingUrl);
          items.push(item);
        }
        if (categories.length > 0) {
          await page.addUrl(categories[nextCategoryIndex++]!);
        } else if (discovery.items.length === 0 && !discovery.validEmptyState) {
          sitemapFallback = true;
          sitemapUrls.add(sitemapUrl);
          await page.addUrl(sitemapUrl);
        }
      } else if (sitemapFallback && sitemapUrls.has(page.requestUrl)) {
        const discovered = /<sitemapindex\b/i.test(page.body) ? parseRedlineSitemapIndex(page.body, site, page.requestUrl) : parseRedlineSitemap(page.body, site, page.requestUrl);
        const sitemapDocument = load(page.body, { xmlMode: true });
        const locEntryCount = sitemapDocument("loc").length;
        logger.info({ site: site.key, sitemapUrl: page.requestUrl, sitemapRootType: /<sitemapindex\b/i.test(page.body) ? "sitemap-index" : "urlset", locEntryCount, nestedSitemapUrls: /<sitemapindex\b/i.test(page.body) ? discovered : [], categoryUrlCount: discovered.length, firstDiscoveredCategories: discovered.slice(0, 3) }, "Redline sitemap discovery completed");
        if (/sitemapindex\b/i.test(page.body)) {
          for (const url of discovered) {
            sitemapUrls.add(url);
            await page.addUrl(url);
          }
        } else {
          for (const url of discovered) {
            if (!seenCategories.has(url)) {
              seenCategories.add(url);
              categories.push(url);
            }
          }
          if (categories.length > 0) await page.addUrl(categories[nextCategoryIndex++]!);
        }
      } else if (items.length < options.limit) {
        processedCategoryPages += 1;
        logger.info({ site: site.key, categoryPageUrl: page.requestUrl, processedCategoryPageCount: processedCategoryPages }, "Redline category page processing");
        const parsed = parseRedlineCategoryHtml(page.body, site, page.requestUrl, options.limit - items.length, {
          finalUrl: page.finalUrl,
          statusCode: page.statusCode ?? undefined,
          onDiagnostics: (value) => logger.info({ site: site.key, ...value }, "Redline Specialist Cars source contract inspected"),
        });
        const paginationUrls = publicPaginationUrls(load(page.body), site);
        if (parsed.length === 0) validEmptyInventory = true;
        for (const item of parsed) {
          if (items.length >= options.limit || seenItems.has(item.listingUrl)) continue;
          seenItems.add(item.listingUrl);
          items.push(item);
        }
        logger.info({ site: site.key, categoryPageUrl: page.requestUrl, matchedCardCount: parsed.length, extractedItemCount: items.length }, "Redline category extraction completed");
        const nextPage = paginationUrls.find((url) => !seenPages.has(url));
        if (items.length < options.limit && nextPage) {
          seenPages.add(nextPage);
          await page.addUrl(nextPage);
        } else if (items.length < options.limit && nextCategoryIndex < categories.length) {
          await page.addUrl(categories[nextCategoryIndex++]!);
        }
      }
      recordScrapeTiming(options, "extractionMs", extractionStartedAt);
    });
  } finally {
    recordScrapeTiming(options, "navigationMs", navigationStartedAt);
    recordScrapeTiming(options, "totalDurationMs", totalStartedAt);
  }
  if (!inventoryPageProcessed) {
    throw new RedlineSourceContractError("Redline inventory URL was not processed", {
      source: inventoryUrl,
      finalUrl: inventoryUrl,
      statusCode: null,
      pageTitle: "",
      matchedCardCount: 0,
      categoryUrlCount: 0,
      paginationLinkCount: 0,
      validEmptyState: false,
    });
  }
  if (categories.length > 0 && processedCategoryPages === 0) {
    throw new RedlineSourceContractError("Redline discovery found categories but no category pages were processed", {
      source: sitemapUrl,
      finalUrl: sitemapUrl,
      statusCode: null,
      pageTitle: "",
      matchedCardCount: 0,
      categoryUrlCount: categories.length,
      paginationLinkCount: 0,
      validEmptyState: false,
    });
  }
  if (processedCategoryPages > 0 && items.length === 0 && !validEmptyInventory) {
    throw new RedlineSourceContractError("Redline category pages were processed but no listings were extracted", {
      source: sitemapUrl,
      finalUrl: sitemapUrl,
      statusCode: null,
      pageTitle: "",
      matchedCardCount: 0,
      categoryUrlCount: categories.length,
      paginationLinkCount: 0,
      validEmptyState: validEmptyInventory,
    });
  }
  return items.slice(0, options.limit);
}
