import { assertSingleSourcePayload, findConfiguredSite, parseScrapeLimit, type BaseScraperConfig } from "@rta/shared";

export const APPROVED_APIFY_SITE_KEYS = ["romans-international", "tom-hartley", "redline-specialist-cars"] as const;
export type ApprovedApifySiteKey = (typeof APPROVED_APIFY_SITE_KEYS)[number];

export interface ScrapingActorInput { siteKey?: unknown; limit?: unknown; }

export interface ValidatedActorInput { siteKey: ApprovedApifySiteKey; limit: number; }

export function parseActorInput(input: unknown, config: BaseScraperConfig): ValidatedActorInput {
  assertSingleSourcePayload(input);
  const body = (input ?? {}) as ScrapingActorInput;
  const siteKey = body.siteKey ?? APPROVED_APIFY_SITE_KEYS[0];
  if (typeof siteKey !== "string" || !APPROVED_APIFY_SITE_KEYS.includes(siteKey as ApprovedApifySiteKey)) {
    throw new Error("siteKey is not an approved Apify source");
  }
  findConfiguredSite(siteKey, config.sites);
  return { siteKey: siteKey as ApprovedApifySiteKey, limit: parseScrapeLimit(body.limit, config.SCRAPE_DEFAULT_LIMIT, Math.min(config.SCRAPE_MAX_LIMIT, 10)) };
}
