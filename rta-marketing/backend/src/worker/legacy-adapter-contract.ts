import type { Page } from "puppeteer";

export interface LegacyScraperLimits {
  maxPages: number;
  minDelayMs: number;
}

export interface LegacyScraperResult {
  cars?: unknown[];
  serverError?: string | null;
}

export type LegacyScraper = (
  page: Page,
  url: string,
  limits?: LegacyScraperLimits,
) => Promise<LegacyScraperResult>;
