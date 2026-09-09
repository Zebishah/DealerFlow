import { createHash } from "node:crypto";
import { z } from "zod";
import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters, SourceKey } from "../contracts/scrape.js";
import { AppError } from "../lib/errors.js";

export interface ScraperLimits {
  maxPages: number;
  maxListings: number;
  minDelayMs: number;
  timeoutMs: number;
}

export const extractedListingSchema = z.object({
  externalId: z.string().trim().min(1).nullable().optional(),
  url: z.string().trim().min(1),
  title: z.string().trim().min(1),
  imageUrl: z.string().trim().min(1).nullable().optional(),
  vin: z.string().trim().min(1).nullable().optional(),
  stockNumber: z.string().trim().min(1).nullable().optional(),
  make: z.string().trim().min(1).nullable().optional(),
  model: z.string().trim().min(1).nullable().optional(),
  trim: z.string().trim().min(1).nullable().optional(),
  year: z.union([z.string(), z.number()]).nullable().optional(),
  price: z.union([z.string(), z.number()]).nullable().optional(),
  odometer: z.union([z.string(), z.number()]).nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  dealerName: z.string().trim().min(1).nullable().optional(),
  location: z.string().trim().min(1).nullable().optional(),
  bodyStyle: z.string().trim().min(1).nullable().optional(),
  transmission: z.string().trim().min(1).nullable().optional(),
  drivetrain: z.string().trim().min(1).nullable().optional(),
  engine: z.string().trim().min(1).nullable().optional(),
  exteriorColor: z.string().trim().min(1).nullable().optional(),
  condition: z.string().trim().min(1).nullable().optional(),
}).strict();

export type ExtractedListing = z.infer<typeof extractedListingSchema>;

function clean(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || null;
}

function identity(title: string, value: ExtractedListing, filters: ScrapeFilters) {
  const yearText = clean(value.year) ?? title.match(/\b(?:19|20)\d{2}\b/)?.[0];
  const withoutYear = title.replace(/^\s*(?:19|20)\d{2}\s+/, "");
  const words = withoutYear.split(/\s+/);
  const make = clean(value.make) ?? clean(filters.make) ?? clean(words[0]);
  const model = clean(value.model) ?? clean(filters.model) ?? clean(words.slice(1, 3).join(" "));
  const year = Number(yearText);
  if (!Number.isInteger(year) || !make || !model) {
    throw new AppError(422, "LISTING_IDENTITY_INCOMPLETE", "The source did not provide year, make, and model");
  }
  return { year, make, model };
}

export function toRawListing(
  source: SourceKey,
  input: unknown,
  filters: ScrapeFilters,
): RawListing {
  const value = extractedListingSchema.parse(input);
  const url = new URL(value.url).href;
  const resolvedIdentity = identity(value.title, value, filters);
  const explicitId = clean(value.externalId) ?? clean(value.vin) ?? clean(value.stockNumber);
  const externalId = explicitId ??
    createHash("sha256").update(url).digest("hex").slice(0, 32);
  const conditionText = clean(value.condition)?.toLowerCase();
  const condition: RawListing["condition"] =
    conditionText === "new" ? "new" :
    conditionText === "certified" ? "certified" :
    conditionText === "used" || conditionText === "pre-owned" ? "used" :
    "unknown";

  return {
    externalId,
    source,
    url,
    title: value.title,
    imageUrl: clean(value.imageUrl),
    vin: clean(value.vin),
    stockNumber: clean(value.stockNumber),
    make: resolvedIdentity.make,
    model: resolvedIdentity.model,
    trim: clean(value.trim),
    year: resolvedIdentity.year,
    price: value.price ?? null,
    odometer: value.odometer ?? null,
    currency: clean(value.currency)?.toUpperCase() ?? "CAD",
    dealerName: clean(value.dealerName),
    location: clean(value.location),
    bodyStyle: clean(value.bodyStyle),
    transmission: clean(value.transmission),
    drivetrain: clean(value.drivetrain),
    engine: clean(value.engine),
    exteriorColor: clean(value.exteriorColor),
    condition,
  };
}

export async function waitForInventory(
  page: Page,
  source: SourceKey,
  cardSelector: string,
  stateSelector: string,
  timeoutMs: number,
): Promise<"cards" | "zero"> {
  const accessState = await page.evaluate(() => ({
    title: document.title,
    body: document.body.innerText.slice(0, 2000),
  }));
  const accessText = `${accessState.title}\n${accessState.body}`;
  if (/sorry,\s*you have been blocked|attention required|you are unable to access|cloudflare|403 forbidden|access denied|request rejected/i.test(accessText)) {
    throw new AppError(502, "SOURCE_ACCESS_BLOCKED", `${source} rejected this browser session`, {
      retryable: false,
      title: accessState.title,
      url: page.url(),
    });
  }

  try {
    await page.waitForSelector(`${cardSelector}, ${stateSelector}`, { timeout: timeoutMs });
  } catch (error) {
    throw new AppError(504, "SOURCE_SELECTOR_TIMEOUT", `${source} did not expose inventory state before timeout`, {
      retryable: true,
      cause: error instanceof Error ? error.name : "unknown",
    });
  }
  const state = await page.evaluate(
    ({ cardSelector: cards, stateSelector: status }) => {
      const cardCount = document.querySelectorAll(cards).length;
      const text = document.querySelector(status)?.textContent?.trim().toLowerCase() ?? "";
      const body = document.body.innerText.toLowerCase();
      return {
        cardCount,
        text,
        blocked: /sorry,\s*you have been blocked|attention required|you are unable to access|cloudflare|403 forbidden|access denied|request rejected/i.test(body),
      };
    },
    { cardSelector, stateSelector },
  );
  if (state.blocked) {
    throw new AppError(502, "SOURCE_ACCESS_BLOCKED", `${source} rejected this browser session`, { retryable: false });
  }
  if (state.cardCount > 0) return "cards";
  if (/\b0\b|no (?:vehicles|results|inventory|matches)/i.test(state.text)) return "zero";
  throw new AppError(502, "SOURCE_SELECTOR_MISMATCH", `${source} returned a page without recognized vehicle cards`, {
    retryable: false,
  });
}

export function parseBatch(
  source: SourceKey,
  values: unknown,
  filters: ScrapeFilters,
  maxListings: number,
): RawListing[] {
  const parsed = z.array(extractedListingSchema).max(maxListings).safeParse(values);
  if (!parsed.success) {
    throw new AppError(502, "SOURCE_PAYLOAD_INVALID", `${source} returned an invalid extraction payload`, {
      retryable: false,
      issues: parsed.error.issues.slice(0, 5).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data.map((value) => toRawListing(source, value, filters));
}
