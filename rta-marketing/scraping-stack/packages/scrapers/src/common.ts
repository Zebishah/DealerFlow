import robotsParserModule from "robots-parser";
import { logger, scrapedItemSchema, type ScrapedItem, type SiteConfig } from "@rta/shared";

export interface ScraperOptions {
  userAgent: string;
  delayMs: number;
  maxConcurrency: number;
  chromiumExecutablePath?: string;
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

export function validateItem(site: SiteConfig, value: Omit<ScrapedItem, "rawData"> & { rawData: Record<string, unknown> }): ScrapedItem | null {
  const parsed = scrapedItemSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn({ site: site.name, issues: parsed.error.issues }, "skipping item that failed scraped-data validation");
    return null;
  }
  return parsed.data;
}
