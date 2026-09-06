import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters } from "../contracts/scrape.js";
import { parseBatch, waitForInventory, type ScraperLimits } from "./common.js";

const cardSelector = ".vlp-cards-base .cell.card, a[href*='/used/'][href*='.html'], a[href*='/new/'][href*='.html']";
const stateSelector = ".results-cell .results, .no-results, .empty-state";

export async function scrapeYorkdaleVolkswagen(
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
): Promise<RawListing[]> {
  const state = await waitForInventory(page, "yorkdalevw", cardSelector, stateSelector, limits.timeoutMs);
  if (state === "zero") return [];
  const extracted: unknown = await page.$$eval(cardSelector, (candidates, maximum) => {
    const values: Array<Record<string, string | null>> = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const link = candidate.matches("a")
        ? candidate as HTMLAnchorElement
        : candidate.querySelector<HTMLAnchorElement>("a[href*='/used/'], a[href*='/new/']");
      const url = link?.href ?? "";
      if (!url || seen.has(url)) continue;
      seen.add(url);

      const card = candidate.matches("a")
        ? candidate.closest("article, li, [class*='card'], [class*='vehicle']") ?? candidate.parentElement ?? candidate
        : candidate;
      const element = card as HTMLElement;
      const image = element.querySelector<HTMLImageElement>(".img-lazy-load, img");
      const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
      const title = element.dataset.name
        ?? element.querySelector("h2, h3, .vehicle-title, .title")?.textContent?.trim()
        ?? text.match(/\b(?:19|20)\d{2}\s+[^$]+/)?.[0]?.trim()
        ?? link?.textContent?.trim()
        ?? "";
      const titleParts = title.split(/\s+/);
      values.push({
        externalId: element.dataset.inventoryitemid ?? url.match(/id(\d+)/i)?.[1] ?? null,
        url,
        title,
        imageUrl: image?.src || image?.dataset.src || null,
        vin: element.dataset.vin ?? null,
        stockNumber: element.dataset.stocknumber ?? null,
        make: element.dataset.make ?? titleParts[1] ?? null,
        model: element.dataset.model ?? titleParts[2] ?? null,
        trim: element.dataset.trim ?? null,
        year: element.dataset.year ?? title.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null,
        price: element.dataset.price ?? element.querySelector(".price-info .value")?.textContent?.trim() ?? text.match(/\$\s*[\d,]+(?:\.\d{2})?/)?.[0] ?? null,
        odometer: element.querySelector(".mileage-tag .body-2")?.textContent?.trim() ?? text.match(/[\d,]+\s*km\b/i)?.[0] ?? null,
        dealerName: "Yorkdale Volkswagen",
        exteriorColor: element.dataset.color ?? null,
        transmission: element.dataset.transmission ?? null,
        drivetrain: element.dataset.drivetrain ?? null,
        engine: element.dataset.engine ?? null,
        condition: element.dataset.condition ?? (/\bnew\b/i.test(text) ? "new" : "used"),
      });
      if (values.length >= maximum) break;
    }
    return values;
  }, limits.maxListings);
  return parseBatch("yorkdalevw", extracted, filters, limits.maxListings);
}
