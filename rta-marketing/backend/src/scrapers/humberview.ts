import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters } from "../contracts/scrape.js";
import { parseBatch, waitForInventory, type ScraperLimits } from "./common.js";

const cardSelector = "article.vc-alpha";
const stateSelector = ".il-totalVehicles__count, .il-noResults, .no-results";

export async function scrapeHumberview(
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
): Promise<RawListing[]> {
  const state = await waitForInventory(page, "humberview", cardSelector, stateSelector, limits.timeoutMs);
  if (state === "zero") return [];
  const extracted: unknown = await page.$$eval(cardSelector, (cards, input) =>
    cards.slice(0, input.maximum).map((card) => {
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
      return {
        externalId: typeof data.sku === "string" ? data.sku : null,
        url: typeof offers.url === "string" ? new URL(offers.url, input.baseUrl).href : "",
        title: typeof data.name === "string" ? data.name : "",
        imageUrl: image?.src || image?.dataset.src || (typeof data.image === "string" ? data.image : null),
        price: typeof offers.price === "string" || typeof offers.price === "number" ? offers.price : null,
        odometer: typeof mileage.value === "string" || typeof mileage.value === "number" ? mileage.value : null,
        make: typeof manufacturer.name === "string" ? manufacturer.name : null,
        exteriorColor: typeof data.color === "string" ? data.color : null,
        transmission: typeof data.vehicleTransmission === "string" ? data.vehicleTransmission : null,
        dealerName: "Humberview Volkswagen",
        condition: "used",
      };
    }),
  { maximum: limits.maxListings, baseUrl });
  return parseBatch("humberview", extracted, filters, limits.maxListings);
}
