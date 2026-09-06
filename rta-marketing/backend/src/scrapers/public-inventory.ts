import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters, SourceKey } from "../contracts/scrape.js";
import { parseBatch, waitForInventory, type ScraperLimits } from "./common.js";

const cardSelector = "a[href*='/inventory/']";
const stateSelector = "main, body";

/**
 * The replacement sources publish a server-rendered /llm/inventory/ page.
 * The parser deliberately uses visible text and links instead of private API
 * calls, so ordinary DOM changes remain isolated to this adapter.
 */
export async function scrapePublicInventory(
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
  source: SourceKey = sourceForBaseUrl(baseUrl),
): Promise<RawListing[]> {
  const state = await waitForInventory(page, source, cardSelector, stateSelector, limits.timeoutMs);
  if (state === "zero") return [];

  const extracted: unknown = await page.evaluate(
    ({ maximum, origin, sourceKey, requestedFilters }) => {
      type Candidate = Record<string, string | null>;
      const details: Record<string, { dealerName: string }> = {
        autoplanet: { dealerName: "Nimnicht Chevrolet" },
        autotrader: { dealerName: "INFINITI of Peoria" },
        humberview: { dealerName: "Baron MINI" },
        yorkdalevw: { dealerName: "Mercedes-Benz of Westwood" },
      };
      const normalize = (value: string | null | undefined): string =>
        (value ?? "").replace(/\s+/g, " ").trim();
      const lower = (value: string | null | undefined): string => normalize(value).toLowerCase();
      const numberFrom = (value: string | null | undefined): number | null => {
        const match = normalize(value).replace(/[$,]/g, "").match(/-?\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : null;
      };
      const priceFrom = (text: string): string | null => {
        const match = text.match(/\$\s*[\d,]+(?:\.\d{2})?/);
        return match?.[0] ?? null;
      };
      const odometerFrom = (text: string): string | null => {
        const match = text.match(/([\d,.]+)\s*(k\s*)?(miles?|mi\b|km\b)/i);
        if (!match) return null;
        const amount = Number((match[1] ?? "").replace(/,/g, ""));
        if (!Number.isFinite(amount)) return null;
        if (/km/i.test(match[3] ?? "")) return String(Math.round(amount));
        return String(Math.round(amount * (match[2] ? 1000 : 1) * 1.60934));
      };
      const titleFrom = (card: Element, link: HTMLAnchorElement, text: string): string => {
        const heading = Array.from(card.querySelectorAll("h1, h2, h3, h4, [class*='title'], [class*='name']"))
          .map((element) => normalize(element.textContent))
          .find((value) => /\b(?:19|20)\d{2}\b/.test(value));
        if (heading) return heading;
        const linkText = normalize(link.textContent);
        if (/\b(?:19|20)\d{2}\b/.test(linkText)) return linkText;
        return text.match(/\b(?:19|20)\d{2}\b[^$|]{0,100}/)?.[0]?.trim() ?? "";
      };
      const cardFor = (link: HTMLAnchorElement): Element =>
        link.closest("article, li, [class*='vehicle'], [class*='inventory'], [class*='card'], [class*='result']")
        ?? link.parentElement
        ?? link;
      const filterMatches = (item: Candidate, text: string): boolean => {
        const haystack = lower(`${item.title} ${text}`);
        if (requestedFilters.make && !haystack.includes(lower(requestedFilters.make))) return false;
        if (requestedFilters.model && !haystack.includes(lower(requestedFilters.model))) return false;
        if (requestedFilters.keyword && !haystack.includes(lower(requestedFilters.keyword))) return false;
        if (requestedFilters.color && !haystack.includes(lower(requestedFilters.color))) return false;
        const year = numberFrom(item.year);
        const price = numberFrom(item.price);
        const odometer = numberFrom(item.odometer);
        if (requestedFilters.minYear != null && (year == null || year < requestedFilters.minYear)) return false;
        if (requestedFilters.maxYear != null && (year == null || year > requestedFilters.maxYear)) return false;
        if (requestedFilters.minPrice != null && (price == null || price < requestedFilters.minPrice)) return false;
        if (requestedFilters.maxPrice != null && (price == null || price > requestedFilters.maxPrice)) return false;
        if (requestedFilters.maxMileage != null && (odometer == null || odometer > requestedFilters.maxMileage)) return false;
        return true;
      };

      const values: Candidate[] = [];
      const seen = new Set<string>();
      for (const element of Array.from(document.querySelectorAll("a[href*='/inventory/']"))) {
        const link = element as HTMLAnchorElement;
        const url = link.href ? new URL(link.href, origin).href : "";
        if (!url || seen.has(url) || url.endsWith("/llm/inventory/") || url.endsWith("/llm/inventory")) continue;
        seen.add(url);
        const card = cardFor(link);
        const text = normalize(card.textContent);
        const title = titleFrom(card, link, text);
        const year = title.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;
        if (!title || !year) continue;
        const titleWithoutPrefix = title.replace(/^\s*(?:new|used|certified)\s+/i, "");
        const titleParts = titleWithoutPrefix.replace(/^\s*(?:19|20)\d{2}\s+/, "").split(/\s+/).filter(Boolean);
        const image = card.querySelector<HTMLImageElement>("img");
        const vin = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i)?.[0] ?? null;
        const condition = /\bcertified\b/i.test(text) ? "certified" : /\bnew\b/i.test(text) ? "new" : "used";
        const item: Candidate = {
          externalId: vin ?? url,
          url,
          title,
          imageUrl: image?.currentSrc || image?.src || image?.dataset.src || null,
          vin,
          make: titleParts[0] ?? null,
          model: titleParts[1] ?? null,
          trim: titleParts.slice(2).join(" ") || null,
          year,
          price: priceFrom(text),
          odometer: odometerFrom(text),
          currency: "USD",
          dealerName: details[sourceKey]?.dealerName ?? null,
          location: null,
          condition,
        };
        if (!filterMatches(item, text)) continue;
        values.push(item);
        if (values.length >= maximum) break;
      }
      return values;
    },
    {
      maximum: limits.maxListings,
      origin: baseUrl,
      sourceKey: source,
      requestedFilters: filters,
    },
  );

  return parseBatch(source, extracted, filters, limits.maxListings);
}

function sourceForBaseUrl(baseUrl: string): SourceKey {
  if (baseUrl.includes("infinitiofpeoria")) return "autotrader";
  if (baseUrl.includes("baronmini")) return "humberview";
  if (baseUrl.includes("mbwestwood")) return "yorkdalevw";
  return "autoplanet";
}
