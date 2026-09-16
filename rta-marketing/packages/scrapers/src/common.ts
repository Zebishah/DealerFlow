import robotsParserModule from "robots-parser";
import type { CheerioAPI } from "cheerio";
import { logger, scrapedItemSchema, type ScrapedItem, type SiteConfig } from "@rta/shared";

export interface ScraperOptions {
  userAgent: string;
  delayMs: number;
  maxConcurrency: 1;
  limit: number;
  crawleeMemoryMbytes: number;
  navigationTimeoutMs: number;
  selectorTimeoutMs: number;
  jobTimeoutMs: number;
  timings?: ScrapeTimings;
  onStage?: (stage: ScrapeStage) => void | Promise<void>;
}

export type ScrapeStage = "queued" | "starting" | "checking-source" | "configured-delay" | "launching-browser" | "loading-page" | "extracting" | "saving" | "retrying" | "completed" | "failed";
export type ScrapeTimingKey = "robotsCheckMs" | "configuredDelayMs" | "browserLaunchMs" | "navigationMs" | "selectorWaitMs" | "extractionMs" | "persistenceMs" | "totalDurationMs";
export type ScrapeTimings = Partial<Record<ScrapeTimingKey, number>>;

export async function reportScrapeStage(options: ScraperOptions, stage: ScrapeStage): Promise<void> {
  await options.onStage?.(stage);
}

export function recordScrapeTiming(options: ScraperOptions, key: ScrapeTimingKey, startedAt: number): void {
  if (options.timings) options.timings[key] = (options.timings[key] ?? 0) + Math.max(0, Date.now() - startedAt);
}

type TimeoutCapableCrawler = {
  run: (requests: string[]) => Promise<unknown>;
  teardown: () => Promise<void>;
};

/** Run one crawler with an upper bound and force teardown on timeout/failure. */
export async function runCrawlerWithTimeout(crawler: TimeoutCapableCrawler, url: string, timeoutMs: number): Promise<void> {
  let timedOut = false;
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      void crawler.teardown().finally(() => reject(new Error(`scrape exceeded ${timeoutMs}ms`)));
    }, timeoutMs);
  });

  try {
    await Promise.race([crawler.run([url]), timeout]);
    if (timedOut) throw new Error(`scrape exceeded ${timeoutMs}ms`);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    await crawler.teardown().catch(() => undefined);
  }
}

const robotsParser = robotsParserModule as unknown as (url: string, text: string) => {
  isAllowed: (url: string, userAgent?: string) => boolean | undefined;
};

export async function assertRobotsAllowed(site: SiteConfig, userAgent: string, targetUrl = site.baseUrl): Promise<void> {
  const robotsUrl = new URL("/robots.txt", site.baseUrl).href;
  const response = await fetch(robotsUrl, { headers: { "User-Agent": userAgent } });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`${site.name} robots.txt returned HTTP ${response.status}`);
  const robots = robotsParser(robotsUrl, await response.text());
  if (robots.isAllowed(targetUrl, userAgent) === false) {
    throw new Error(`${site.name} robots.txt disallows ${targetUrl}`);
  }
}

export function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function absoluteUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

export function canonicalUrl(value: string | undefined, baseUrl: string): string | null {
  const url = absoluteUrl(value, baseUrl);
  if (!url) return null;
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

export function cleanText(value: string | undefined | null): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

export function textFrom($: CheerioAPI, selector: string): string | null {
  return cleanText($(selector).first().text());
}

/** Read common label/value layouts without guessing a value from unrelated text. */
export function labeledValue($: CheerioAPI, labels: string[], root?: ReturnType<CheerioAPI>): string | null {
  const wanted = new Set(labels.map((label) => label.toLowerCase()));
  let result: string | null = null;
  const scope = root ?? $("body");
  scope.find("dt, dd, th, td, li, div, p").each((_index, element) => {
    if (result) return;
    const node = $(element);
    const children = node.children();
    const firstChildText = cleanText(children.first().text());
    if (children.length >= 2 && firstChildText && wanted.has(firstChildText.toLowerCase())) {
      result = cleanText(children.eq(1).text());
      return;
    }
    const label = cleanText(node.children().first().text()) ?? cleanText(node.clone().children().remove().end().text());
    if (label && wanted.has(label.toLowerCase())) {
      const sibling = node.nextAll("dd, td, span, strong, b, p").first();
      result = cleanText(sibling.text());
      return;
    }
    const directText = cleanText(node.text());
    if (!directText) return;
    for (const wantedLabel of wanted) {
      const escapedLabel = wantedLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = directText.match(new RegExp(`^${escapedLabel}\\s*[:\\-]\\s*(.+)$`, "i"));
      if (match?.[1]) {
        result = cleanText(match[1]);
        return;
      }
    }
  });
  return result;
}

/** Prefer a real lazy-loaded image over a transparent placeholder in src. */
export function imageUrlFromCandidates(candidates: Array<string | undefined | null>, baseUrl: string): string | null {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value || value.startsWith("data:") || value.startsWith("blob:")) continue;
    const srcsetCandidate = value.includes(",")
      ? value.split(",").map((entry) => entry.trim().split(/\s+/)[0]).filter(Boolean).at(-1)
      : value;
    const absolute = absoluteUrl(srcsetCandidate, baseUrl);
    if (absolute && !/transparent|placeholder|spacer|blank\.gif/i.test(absolute)) return absolute;
  }
  return null;
}

export function validateItem(site: SiteConfig, value: Omit<ScrapedItem, "rawData"> & { rawData: Record<string, unknown> }): ScrapedItem | null {
  const parsed = scrapedItemSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn({ site: site.name, issues: parsed.error.issues }, "skipping item that failed scraped-data validation");
    return null;
  }
  return parsed.data;
}
