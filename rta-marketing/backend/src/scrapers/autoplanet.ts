import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters } from "../contracts/scrape.js";
import { parseBatch, waitForInventory, type ScraperLimits } from "./common.js";

const cardSelector = ".vehicle-card";
const stateSelector = ".srp__vehicle-count, .advanced-filters-wrap__heading-custom h1, .no-results, .empty-state";

export async function scrapeAutoPlanet(
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
): Promise<RawListing[]> {
  const state = await waitForInventory(page, "autoplanet", cardSelector, stateSelector, limits.timeoutMs);
  if (state === "zero") return [];
  const extracted: unknown = await page.$$eval(cardSelector, (cards, input) =>
    cards.slice(0, input.maxListings).map((card) => {
      const element = card as HTMLElement;
      const image = element.querySelector<HTMLImageElement>(".vehicle-card__image");
      const link = element.querySelector<HTMLAnchorElement>("a.vehicle-card__image-link");
      return {
        externalId: element.dataset.vehicleId ?? element.dataset.inventoryitemid ?? null,
        url: link?.href ?? "",
        title: element.querySelector(".vehicle-card__title")?.textContent?.trim() ?? "",
        imageUrl: image?.src || image?.dataset.src || null,
        vin: element.dataset.vehicleVin ?? null,
        stockNumber: element.querySelector(".vehicle-card__stock")?.textContent?.replace(/stock\s*#?:?/i, "").trim() ?? null,
        make: element.dataset.vehicleMake ?? null,
        model: element.dataset.vehicleModel ?? null,
        trim: element.dataset.vehicleTrim ?? null,
        year: element.dataset.vehicleYear ?? null,
        price: element.querySelector('[convertus-data-id="srp__dealer-price"]')?.textContent?.trim() ?? null,
        odometer: element.querySelector('[data-spec="odometer"] .detailed-specs__value')?.textContent?.trim() ?? null,
        dealerName: "AutoPlanet",
        location: element.querySelector(".vehicle-card__location")?.textContent?.replace(/this vehicle is located in/i, "").trim() ?? null,
        exteriorColor: element.dataset.vehicleColour ?? null,
        condition: element.dataset.vehicleCondition ?? "used",
      };
    }),
  { maxListings: limits.maxListings });
  return parseBatch("autoplanet", extracted, filters, limits.maxListings);
}
