import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters } from "../contracts/scrape.js";
import { parseBatch, waitForInventory, type ScraperLimits } from "./common.js";

const cardSelector = "article.vc-alpha, a[href*='/used-inventory/'], a[href*='/new-inventory/']";
const stateSelector = ".il-totalVehicles__count, [class*='totalVehicles'], .il-noResults, .no-results, .empty-state";

export async function scrapeHumberview(
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
): Promise<RawListing[]> {
  const state = await waitForInventory(page, "humberview", cardSelector, stateSelector, limits.timeoutMs);
  if (state === "zero") return [];
  const extracted: unknown = await page.$$eval(cardSelector, (candidates, input) => {
    const values: Array<Record<string, string | null>> = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
      const link = candidate.matches("a")
        ? candidate as HTMLAnchorElement
        : candidate.querySelector<HTMLAnchorElement>("a[href*='/used-inventory/'], a[href*='/new-inventory/']");
      const url = link?.href ? new URL(link.href, input.baseUrl).href : "";
      if (!url || seen.has(url)) continue;
      seen.add(url);

      const card = candidate.matches("a")
        ? candidate.closest("article, li, [class*='card'], [class*='vehicle']") ?? candidate.parentElement ?? candidate
        : candidate;
      const text = (card.textContent ?? "").replace(/\s+/g, " ").trim();
      const lines = (card.textContent ?? "").split(/\n+/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
      const script = card.querySelector('script[type="application/ld+json"]')?.textContent;
      let data: Record<string, unknown> = {};
      if (script) {
        try {
          const parsed: unknown = JSON.parse(script);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
        } catch { /* validation below reports incomplete records */ }
      }
      const offers = data.offers && typeof data.offers === "object" && !Array.isArray(data.offers)
        ? data.offers as Record<string, unknown> : {};
      const manufacturer = data.manufacturer && typeof data.manufacturer === "object" && !Array.isArray(data.manufacturer)
        ? data.manufacturer as Record<string, unknown> : {};
      const mileage = data.mileageFromOdometer && typeof data.mileageFromOdometer === "object" && !Array.isArray(data.mileageFromOdometer)
        ? data.mileageFromOdometer as Record<string, unknown> : {};
      const image = card.querySelector<HTMLImageElement>(".vc-vehicleImage img");
      const title = typeof data.name === "string"
        ? data.name
        : lines.find((line) => /^(?:19|20)\d{2}\s+\S+/i.test(line)) ?? link?.textContent?.trim() ?? "";
      const titleParts = title.split(/\s+/);
      const year = title.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? null;
      const price = typeof offers.price === "string" || typeof offers.price === "number"
        ? String(offers.price)
        : text.match(/\$\s*[\d,]+(?:\.\d{2})?/)?.[0] ?? null;
      const odometer = typeof mileage.value === "string" || typeof mileage.value === "number"
        ? String(mileage.value)
        : text.match(/[\d,]+\s*km\b/i)?.[0] ?? null;
      values.push({
        externalId: typeof data.sku === "string" ? data.sku : url.match(/id(\d+)/i)?.[1] ?? null,
        url,
        title,
        imageUrl: image?.src || image?.dataset.src || (typeof data.image === "string" ? data.image : null),
        price,
        odometer,
        make: typeof manufacturer.name === "string" ? manufacturer.name : titleParts[1] ?? null,
        model: titleParts[2] ?? null,
        exteriorColor: typeof data.color === "string" ? data.color : null,
        transmission: typeof data.vehicleTransmission === "string" ? data.vehicleTransmission : null,
        dealerName: "Humberview Volkswagen",
        year,
        stockNumber: text.match(/stock\s*#?\s*:?\s*([A-Z0-9-]+)/i)?.[1] ?? null,
        condition: /\bnew\b/i.test(text) ? "new" : "used",
      });
      if (values.length >= input.maximum) break;
    }
    return values;
  }, { maximum: limits.maxListings, baseUrl });
  return parseBatch("humberview", extracted, filters, limits.maxListings);
}
