import { CheerioCrawler, RequestQueue } from "crawlee";
import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { logger, type ScrapedItem, type SiteConfig } from "@rta/shared";
import {
  absoluteUrl,
  assertRobotsAllowed,
  imageUrlFromCandidates,
  recordScrapeTiming,
  reportScrapeStage,
  runCrawlerWithTimeout,
  validateItem,
  wait,
  type ScraperOptions,
} from "./common.js";

const LISTING_CARD_SELECTOR = 'a[href^="/listings/"]';
const STRUCTURED_DATA_SELECTOR = 'script[type="application/ld+json"], script#__NEXT_DATA__, script[type="application/json"]';
const ANTI_BOT_MARKERS = ["captcha", "access denied", "verify you are human", "cloudflare", "akamai", "bot detected", "just a moment"];

export interface CollectorCarListDiagnostics {
  finalUrl: string;
  statusCode: number | null;
  pageTitle: string;
  matchedCardCount: number;
  knownListingLinkCount: number;
  structuredJsonBlockCount: number;
  validEmptyState: boolean;
}

export interface CollectorCarListParseContext {
  finalUrl?: string;
  statusCode?: number;
  onDiagnostics?: (diagnostics: CollectorCarListDiagnostics) => void;
}

export class CollectorCarListSourceContractError extends Error {
  constructor(message: string, readonly diagnostics: CollectorCarListDiagnostics) {
    super(message);
    this.name = "CollectorCarListSourceContractError";
  }
}

function cleanText(value: string | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function firstText(card: ReturnType<CheerioAPI>, selector: string): string | null {
  return cleanText(card.find(selector).first().text());
}

function labeledValue($: CheerioAPI, card: ReturnType<CheerioAPI>, label: string): string | null {
  let value: string | null = null;
  card.find("div").each((_index, element) => {
    if (value) return;
    const children = $(element).children("p");
    if (children.length < 2) return;
    if (cleanText(children.eq(0).text())?.toLowerCase() !== label.toLowerCase()) return;
    value = cleanText(children.eq(1).text());
  });
  return value;
}

function sourceContractDiagnostics($: CheerioAPI, sourceUrl: string, context: CollectorCarListParseContext): CollectorCarListDiagnostics {
  const bodyText = $("body").text();
  const pageTitle = cleanText($("title").first().text())?.slice(0, 200) ?? "";
  const knownListingLinkCount = $(LISTING_CARD_SELECTOR).length;
  const validEmptyState = /(?:^|\D)0\s+cars?\s+available/i.test(bodyText) && /no listings found/i.test(bodyText);
  return {
    finalUrl: context.finalUrl ?? sourceUrl,
    statusCode: context.statusCode ?? null,
    pageTitle,
    matchedCardCount: knownListingLinkCount,
    knownListingLinkCount,
    structuredJsonBlockCount: $(STRUCTURED_DATA_SELECTOR).length,
    validEmptyState,
  };
}

function isAntiBotPage($: CheerioAPI): boolean {
  const bodyText = $("body").text().toLowerCase();
  return ANTI_BOT_MARKERS.some((marker) => bodyText.includes(marker));
}

function throwUnexpectedContract(diagnostics: CollectorCarListDiagnostics, reason: string): never {
  throw new CollectorCarListSourceContractError(`CollectorCarList source contract not detected: ${reason}`, diagnostics);
}

/** Parse the current public, server-rendered CollectorCarList listing cards. */
export function parseCollectorCarListHtml(html: string, site: SiteConfig, sourceUrl: string, limit: number, context: CollectorCarListParseContext = {}): ScrapedItem[] {
  const $ = load(html);
  const diagnostics = sourceContractDiagnostics($, sourceUrl, context);
  context.onDiagnostics?.(diagnostics);

  if (isAntiBotPage($)) throwUnexpectedContract(diagnostics, "anti-bot or interstitial page");
  if (diagnostics.statusCode !== null && diagnostics.statusCode >= 400) throwUnexpectedContract(diagnostics, `HTTP ${diagnostics.statusCode}`);
  if (diagnostics.matchedCardCount === 0) {
    if (diagnostics.validEmptyState) return [];
    throwUnexpectedContract(diagnostics, "no listing cards or valid empty-inventory state");
  }

  const items: ScrapedItem[] = [];
  const seenUrls = new Set<string>();
  $(LISTING_CARD_SELECTOR).each((_index, element) => {
    if (items.length >= limit) return false;
    const card = $(element);
    const listingUrl = absoluteUrl(card.attr("href"), site.baseUrl);
    const title = firstText(card, "h3");
    if (!title || !listingUrl || seenUrls.has(listingUrl)) return;
    seenUrls.add(listingUrl);

    const yearLine = firstText(card, "p") ?? "";
    const year = yearLine.match(/\b(?:18|19|20)\d{2}\b/)?.[0] ?? null;
    const price = labeledValue($, card, "Asking");
    const mileage = labeledValue($, card, "Miles");
    const city = labeledValue($, card, "Location");
    const image = card.find('img[data-nimg="fill"], img').first();
    const thumbnailUrl = imageUrlFromCandidates([
      image.attr("data-src"),
      image.attr("data-lazy-src"),
      image.attr("data-original"),
      image.attr("data-image"),
      image.attr("data-srcset"),
      image.attr("srcset"),
      image.attr("src"),
    ], site.baseUrl);

    const item = validateItem(site, {
      title,
      price,
      year,
      mileage,
      city,
      listingUrl,
      thumbnailUrl,
      rawData: {
        source: sourceUrl,
        sourceKey: site.key,
        listingId: card.attr("href") ?? null,
        title,
        price,
        year,
        mileage,
        city,
        listingUrl,
        thumbnailUrl,
      },
    });
    if (item) items.push(item);
    return;
  });

  if (items.length === 0) throwUnexpectedContract(diagnostics, "listing links matched but no valid listing cards were extracted");
  return items;
}

export async function scrapeCollectorCarList(site: SiteConfig, options: ScraperOptions): Promise<ScrapedItem[]> {
  const totalStartedAt = Date.now();
  const robotsStartedAt = Date.now();
  await reportScrapeStage(options, "checking-source");
  await assertRobotsAllowed(site, options.userAgent);
  recordScrapeTiming(options, "robotsCheckMs", robotsStartedAt);

  const delayStartedAt = Date.now();
  await reportScrapeStage(options, "configured-delay");
  await wait(options.delayMs);
  recordScrapeTiming(options, "configuredDelayMs", delayStartedAt);

  const items: ScrapedItem[] = [];
  const requestQueue = await RequestQueue.open(`rta-${site.key}-${Date.now()}`);
  const crawler = new CheerioCrawler({
    maxConcurrency: 1,
    requestQueue,
    maxRequestRetries: 1,
    requestHandlerTimeoutSecs: Math.ceil(options.jobTimeoutMs / 1000),
    maxRequestsPerCrawl: 1,
    preNavigationHooks: [async (_context, gotOptions) => {
      gotOptions.headers = { ...gotOptions.headers, "user-agent": options.userAgent, "accept-language": "en-US,en;q=0.8" };
    }],
    requestHandler: async ({ body, request, response }) => {
      await reportScrapeStage(options, "extracting");
      const extractionStartedAt = Date.now();
      const diagnostics: Partial<CollectorCarListDiagnostics> = {};
      const finalUrl = String(response.url ?? request.loadedUrl ?? request.url);
      try {
        items.push(...parseCollectorCarListHtml(String(body), site, request.url, options.limit, {
          finalUrl,
          statusCode: response.statusCode,
          onDiagnostics: (value) => Object.assign(diagnostics, value),
        }));
        logger.info({ site: site.key, ...diagnostics }, "CollectorCarList source contract inspected");
      } catch (error) {
        if (error instanceof CollectorCarListSourceContractError) {
          logger.error({ site: site.key, ...error.diagnostics }, "CollectorCarList source contract missing");
        }
        throw error;
      } finally {
        recordScrapeTiming(options, "extractionMs", extractionStartedAt);
      }
    },
  });

  await reportScrapeStage(options, "loading-page");
  const navigationStartedAt = Date.now();
  try {
    await runCrawlerWithTimeout(crawler, site.baseUrl, options.jobTimeoutMs);
  } finally {
    recordScrapeTiming(options, "navigationMs", navigationStartedAt);
    await requestQueue.drop();
    recordScrapeTiming(options, "totalDurationMs", totalStartedAt);
  }
  return items.slice(0, options.limit);
}
