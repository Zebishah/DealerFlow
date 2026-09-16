import { load } from "cheerio";
import type { CheerioAPI } from "cheerio";
import { logger, type ScrapedItem, type SiteConfig } from "@rta/shared";
import { crawlCheerioUrls, type CheerioPage } from "./cheerio-runtime.js";
import {
  canonicalUrl,
  cleanText,
  imageUrlFromCandidates,
  labeledValue,
  recordScrapeTiming,
  reportScrapeStage,
  textFrom,
  validateItem,
  wait,
  type ScraperOptions,
} from "./common.js";

const DETAIL_PATH = /^\/used-car-details\/[^?#]+\/?$/i;
const ANTI_BOT_MARKERS = ["captcha", "access denied", "verify you are human", "cloudflare", "akamai", "bot detected", "just a moment"];
const INVENTORY_CARD_SELECTOR = ".used-list-vehicle-wrap";
const INVENTORY_DETAIL_LINK_SELECTOR = 'a[href*="/used-car-details/"]';

export interface TomHartleyDiagnostics {
  source: string;
  finalUrl: string;
  statusCode: number | null;
  pageTitle: string;
  matchedCardCount: number;
  detailUrlCount: number;
  validEmptyState: boolean;
  elapsedMs?: number;
}

export class TomHartleySourceContractError extends Error {
  constructor(message: string, readonly diagnostics: TomHartleyDiagnostics) {
    super(message);
    this.name = "TomHartleySourceContractError";
  }
}

function detailUrl(value: string | undefined, site: SiteConfig): string | null {
  const url = canonicalUrl(value, site.baseUrl);
  if (!url) return null;
  const parsed = new URL(url);
  return parsed.origin === new URL(site.baseUrl).origin && DETAIL_PATH.test(parsed.pathname) ? url : null;
}

function visibleBodyText($: CheerioAPI): string {
  const body = $("body").clone();
  body.find("script, style, noscript, template").remove();
  return cleanText(body.text()) ?? "";
}

function hasExplicitEmptyInventory(text: string): boolean {
  return /(?:no|zero)\s+(?:vehicles|cars|stock|listings|results)|(?:vehicles|cars|stock|listings)\s+(?:not|currently not)\s+available|nothing\s+found/i.test(text);
}

export function yearFromTomHartleyTitle(title: string | null): string | null {
  const match = title?.match(/^((?:19|20)\d{2})(?:\/\d{2})?\b/);
  return match?.[1] ?? null;
}

function tomHartleyImage($: CheerioAPI, jsonImage: unknown, baseUrl: string): string | null {
  const candidates: Array<string | undefined | null> = [];
  const addImages = (selector: string): void => {
    $(selector).each((_index, element) => {
      const image = $(element);
      candidates.push(image.attr("src"), image.attr("srcset"), image.attr("data-src"), image.attr("data-srcset"));
    });
  };
  candidates.push($("meta[property='og:image']").attr("content"));
  addImages(".gallery__open img, .used-details-title ~ * img, .used-list-vehicle__image img");
  $("img").each((_index, element) => {
    const image = $(element);
    const attributes = `${image.attr("class") ?? ""} ${image.attr("id") ?? ""} ${image.attr("src") ?? ""}`;
    if (!/logo|header|branding|brand-mark/i.test(attributes)) {
      candidates.push(image.attr("src"), image.attr("srcset"), image.attr("data-src"), image.attr("data-srcset"));
    }
  });
  return jsonLdImage(jsonImage, baseUrl) ?? imageUrlFromCandidates(candidates, baseUrl);
}

export interface TomHartleyInventoryDiscovery {
  detailUrls: string[];
  diagnostics: TomHartleyDiagnostics;
}

export function parseTomHartleyInventoryHtml(
  html: string,
  site: SiteConfig,
  sourceUrl: string,
  context: { finalUrl?: string; statusCode?: number; onDiagnostics?: (value: TomHartleyDiagnostics) => void } = {},
): TomHartleyInventoryDiscovery {
  const startedAt = Date.now();
  const $ = load(html);
  const visibleText = visibleBodyText($);
  const urls = new Set<string>();
  const cards = $(INVENTORY_CARD_SELECTOR).filter((_index, element) => $(element).find(INVENTORY_DETAIL_LINK_SELECTOR).length > 0);
  cards.find(INVENTORY_DETAIL_LINK_SELECTOR).each((_index, element) => {
    const parsed = detailUrl($(element).attr("href"), site);
    if (parsed) urls.add(parsed);
  });
  const diagnostics: TomHartleyDiagnostics = {
    source: sourceUrl,
    finalUrl: context.finalUrl ?? sourceUrl,
    statusCode: context.statusCode ?? null,
    pageTitle: cleanText($("title").first().text())?.slice(0, 200) ?? "",
    matchedCardCount: cards.length,
    detailUrlCount: urls.size,
    validEmptyState: hasExplicitEmptyInventory(visibleText),
    elapsedMs: Date.now() - startedAt,
  };
  context.onDiagnostics?.(diagnostics);
  if (ANTI_BOT_MARKERS.some((marker) => visibleText.toLowerCase().includes(marker))) {
    throw new TomHartleySourceContractError("Tom Hartley inventory contract not detected: anti-bot or interstitial page", diagnostics);
  }
  if (diagnostics.statusCode !== null && diagnostics.statusCode >= 400) {
    throw new TomHartleySourceContractError(`Tom Hartley inventory contract not detected: HTTP ${diagnostics.statusCode}`, diagnostics);
  }
  if (urls.size === 0 && !diagnostics.validEmptyState) {
    throw new TomHartleySourceContractError("Tom Hartley inventory contract not detected: no vehicle-detail URLs", diagnostics);
  }
  return { detailUrls: [...urls], diagnostics };
}

export function isTomHartleyVehicleDetailUrl(value: string, baseUrl = "https://www.tomhartley.com/"): boolean {
  return detailUrl(value, { baseUrl, key: "tom-hartley", name: "Tom Hartley", engine: "cheerio", delayMs: 0, maxConcurrency: 1 } as SiteConfig) !== null;
}

export function parseTomHartleySitemap(html: string, site: SiteConfig, sourceUrl = site.baseUrl): string[] {
  const $ = load(html, { xmlMode: true });
  const urls = new Set<string>();
  $("url loc, sitemap loc, loc").each((_index, element) => {
    const value = cleanText($(element).text());
    const parsed = value ? detailUrl(value, site) : null;
    if (parsed) urls.add(parsed);
  });
  if (urls.size === 0 && !/no (?:vehicles|cars|listings)|empty sitemap/i.test(cleanText($("body").text()) ?? "")) {
    throw new TomHartleySourceContractError("Tom Hartley sitemap contract not detected: no vehicle-detail URLs", {
      source: sourceUrl,
      finalUrl: sourceUrl,
      statusCode: null,
      pageTitle: "",
      matchedCardCount: 0,
      detailUrlCount: 0,
      validEmptyState: false,
    });
  }
  return [...urls];
}

function jsonLdObjects($: CheerioAPI): Record<string, unknown>[] {
  const values: Record<string, unknown>[] = [];
  $("script[type='application/ld+json']").each((_index, element) => {
    try {
      const parsed: unknown = JSON.parse($(element).text());
      const add = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) value.forEach(add);
        else {
          const object = value as Record<string, unknown>;
          if (Array.isArray(object["@graph"])) object["@graph"].forEach(add);
          values.push(object);
        }
      };
      add(parsed);
    } catch {
      // A malformed JSON-LD block is not fatal; the labeled HTML remains authoritative fallback data.
    }
  });
  return values;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") return cleanText(String(value));
  return null;
}

function jsonLdImage(value: unknown, baseUrl: string): string | null {
  const candidates = Array.isArray(value) ? value : [value];
  return imageUrlFromCandidates(candidates.map((candidate) => typeof candidate === "string" ? candidate : typeof candidate === "object" && candidate !== null ? (candidate as { url?: string }).url : undefined), baseUrl);
}

function jsonLdVehicle($: CheerioAPI, site: SiteConfig): Record<string, unknown> | null {
  const objects = jsonLdObjects($);
  return objects.find((value) => {
    const type = value["@type"];
    return (Array.isArray(type) ? type : [type]).some((entry) => typeof entry === "string" && /vehicle|product|car/i.test(entry))
      || typeof value.name === "string" && (value.year !== undefined || value.model !== undefined || value.brand !== undefined);
  }) ?? null;
}

function jsonLdPrice(value: Record<string, unknown>): string | null {
  const offers = value.offers;
  if (offers && typeof offers === "object" && !Array.isArray(offers)) {
    const price = stringValue((offers as Record<string, unknown>).price);
    if (price) return price;
  }
  return stringValue(value.price);
}

export function parseTomHartleyDetailHtml(
  html: string,
  site: SiteConfig,
  sourceUrl: string,
  context: { finalUrl?: string; statusCode?: number; onDiagnostics?: (value: TomHartleyDiagnostics) => void } = {},
): ScrapedItem {
  const startedAt = Date.now();
  const $ = load(html);
  const bodyText = visibleBodyText($);
  const json = jsonLdVehicle($, site);
  const diagnostics: TomHartleyDiagnostics = {
    source: sourceUrl,
    finalUrl: context.finalUrl ?? sourceUrl,
    statusCode: context.statusCode ?? null,
    pageTitle: cleanText($("title").first().text())?.slice(0, 200) ?? "",
    matchedCardCount: json ? 1 : 0,
    detailUrlCount: 0,
    validEmptyState: false,
    elapsedMs: Date.now() - startedAt,
  };
  context.onDiagnostics?.(diagnostics);
  if (ANTI_BOT_MARKERS.some((marker) => bodyText.toLowerCase().includes(marker))) {
    throw new TomHartleySourceContractError("Tom Hartley detail contract not detected: anti-bot or interstitial page", diagnostics);
  }
  if (diagnostics.statusCode !== null && diagnostics.statusCode >= 400) {
    throw new TomHartleySourceContractError(`Tom Hartley detail contract not detected: HTTP ${diagnostics.statusCode}`, diagnostics);
  }

  const brand = json?.brand && typeof json.brand === "object" ? stringValue((json.brand as Record<string, unknown>).name) : stringValue(json?.brand);
  const title = stringValue(json?.name) ?? textFrom($, "h1");
  const listingUrl = canonicalUrl(stringValue(json?.url) ?? sourceUrl, site.baseUrl);
  const image = tomHartleyImage($, json?.image, site.baseUrl);
  const price = textFrom($, "h4.price, .used-details-title + .price") ?? jsonLdPrice(json ?? {}) ?? labeledValue($, ["price", "our price", "sale price"]);
  const year = stringValue(json?.productionDate) ?? stringValue(json?.vehicleModelDate) ?? stringValue(json?.modelDate) ?? stringValue(json?.year) ?? labeledValue($, ["year", "registration year"]) ?? yearFromTomHartleyTitle(title);
  const mileage = labeledValue($, ["mileage", "miles", "odometer"]) ?? stringValue(json?.mileageFromOdometer && typeof json.mileageFromOdometer === "object" ? (json.mileageFromOdometer as Record<string, unknown>).value : null);
  const city = labeledValue($, ["city", "location", "town"]);
  const model = stringValue(json?.model);
  const fuel = stringValue(json?.fuelType) ?? labeledValue($, ["fuel", "fuel type"]);
  const transmission = stringValue(json?.vehicleTransmission) ?? labeledValue($, ["transmission", "gearbox"]);
  const bodyType = stringValue(json?.bodyType) ?? labeledValue($, ["body type"]);
  if (!title || !listingUrl) {
    throw new TomHartleySourceContractError("Tom Hartley detail contract not detected: no valid vehicle title or URL", diagnostics);
  }
  const item = validateItem(site, {
    title,
    price,
    year,
    mileage,
    city,
    listingUrl,
    thumbnailUrl: image,
    rawData: {
      source: sourceUrl,
      sourceKey: site.key,
      jsonLd: json ?? null,
      make: brand ?? stringValue(json?.manufacturer),
      model,
      fuel,
      transmission,
      bodyType,
      title,
      price,
      year,
      mileage,
      city,
      listingUrl,
      thumbnailUrl: image,
    },
  });
  if (!item) throw new TomHartleySourceContractError("Tom Hartley detail contract not detected: extracted vehicle failed validation", diagnostics);
  return item;
}

export async function scrapeTomHartley(site: SiteConfig, options: ScraperOptions, dependencies: { crawl?: typeof crawlCheerioUrls } = {}): Promise<ScrapedItem[]> {
  const totalStartedAt = Date.now();
  await reportScrapeStage(options, "checking-source");
  const delayStartedAt = Date.now();
  await reportScrapeStage(options, "configured-delay");
  await wait(options.delayMs);
  recordScrapeTiming(options, "configuredDelayMs", delayStartedAt);
  const inventoryUrl = new URL("/used/", site.baseUrl).href;
  const details: string[] = [];
  const seenDetails = new Set<string>();
  const items: ScrapedItem[] = [];
  let nextDetailIndex = 0;
  let processedDetailPages = 0;
  let validEmptyInventory = false;
  let inventoryPageProcessed = 0;
  let inventoryDiagnostics: TomHartleyDiagnostics | undefined;
  await reportScrapeStage(options, "loading-page");
  const navigationStartedAt = Date.now();
  try {
    await (dependencies.crawl ?? crawlCheerioUrls)(site, options, [inventoryUrl], Math.max(1, options.limit + 1), async (page: CheerioPage) => {
      const extractionStartedAt = Date.now();
      await reportScrapeStage(options, "extracting");
      if (page.requestUrl === inventoryUrl && inventoryPageProcessed === 0) {
        inventoryPageProcessed += 1;
        const discovery = parseTomHartleyInventoryHtml(page.body, site, page.requestUrl, {
          finalUrl: page.finalUrl,
          statusCode: page.statusCode ?? undefined,
          onDiagnostics: (diagnostics) => logger.info({ site: site.key, ...diagnostics }, "Tom Hartley inventory contract inspected"),
        });
        inventoryDiagnostics = discovery.diagnostics;
        validEmptyInventory = discovery.diagnostics.validEmptyState;
        logger.info({ site: site.key, inventoryUrl: page.requestUrl, discoveredDetailUrlCount: discovery.detailUrls.length, firstDiscoveredUrls: discovery.detailUrls.slice(0, 3) }, "Tom Hartley inventory discovery completed");
        for (const url of discovery.detailUrls.slice(0, options.limit)) {
          seenDetails.add(url);
          details.push(url);
        }
        if (details.length > 0) await page.addUrl(details[nextDetailIndex++]!);
      } else if (items.length < options.limit && page.requestUrl !== inventoryUrl) {
        processedDetailPages += 1;
        logger.info({ site: site.key, detailPageUrl: page.requestUrl, processedDetailPageCount: processedDetailPages }, "Tom Hartley detail page processing");
        const item = parseTomHartleyDetailHtml(page.body, site, page.requestUrl, {
          finalUrl: page.finalUrl,
          statusCode: page.statusCode ?? undefined,
          onDiagnostics: (diagnostics) => logger.info({ site: site.key, ...diagnostics }, "Tom Hartley source contract inspected"),
        });
        if (!items.some((existing) => existing.listingUrl === item.listingUrl)) items.push(item);
        logger.info({ site: site.key, detailPageUrl: page.requestUrl, extractedItemCount: items.length }, "Tom Hartley detail extraction completed");
        if (items.length < options.limit && nextDetailIndex < details.length) {
          await page.addUrl(details[nextDetailIndex++]!);
        }
      }
      recordScrapeTiming(options, "extractionMs", extractionStartedAt);
    });
  } finally {
    recordScrapeTiming(options, "navigationMs", navigationStartedAt);
    recordScrapeTiming(options, "totalDurationMs", totalStartedAt);
  }
  if (inventoryPageProcessed === 0) {
    throw new TomHartleySourceContractError("Tom Hartley inventory URL was not processed", {
      source: inventoryUrl,
      finalUrl: inventoryUrl,
      statusCode: null,
      pageTitle: "",
      matchedCardCount: 0,
      detailUrlCount: 0,
      validEmptyState: false,
    });
  }
  if (details.length > 0 && processedDetailPages === 0) {
    throw new TomHartleySourceContractError("Tom Hartley discovery found detail URLs but no detail pages were processed", {
      ...(inventoryDiagnostics ?? { source: inventoryUrl, finalUrl: inventoryUrl, statusCode: null, pageTitle: "", matchedCardCount: 0, detailUrlCount: details.length, validEmptyState: false }),
      detailUrlCount: details.length,
    });
  }
  if (processedDetailPages > 0 && items.length === 0 && !validEmptyInventory) {
    throw new TomHartleySourceContractError("Tom Hartley detail pages were processed but no listings were extracted", {
      ...(inventoryDiagnostics ?? { source: inventoryUrl, finalUrl: inventoryUrl, statusCode: null, pageTitle: "", matchedCardCount: 0, detailUrlCount: details.length, validEmptyState: false }),
      matchedCardCount: processedDetailPages,
      detailUrlCount: details.length,
      validEmptyState: validEmptyInventory,
    });
  }
  return items.slice(0, options.limit);
}
