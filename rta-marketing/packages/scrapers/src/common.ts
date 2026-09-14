import robotsParserModule from "robots-parser";
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

export async function assertRobotsAllowed(site: SiteConfig, userAgent: string): Promise<void> {
  const robotsUrl = new URL("/robots.txt", site.baseUrl).href;
  const response = await fetch(robotsUrl, { headers: { "User-Agent": userAgent } });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`${site.name} robots.txt returned HTTP ${response.status}`);
  const robots = robotsParser(robotsUrl, await response.text());
  if (robots.isAllowed(site.baseUrl, userAgent) === false) {
    throw new Error(`${site.name} robots.txt disallows ${site.baseUrl}`);
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
