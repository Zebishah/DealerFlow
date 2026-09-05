import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters } from "../contracts/scrape.js";
import { parseBatch, waitForInventory, type ScraperLimits } from "./common.js";

const cardSelector = ".vlp-cards-base .cell.card";
const stateSelector = ".results-cell .results, .no-results, .empty-state";

export async function scrapeYorkdaleVolkswagen(
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
): Promise<RawListing[]> {
  const state = await waitForInventory(page, "yorkdalevw", cardSelector, stateSelector, limits.timeoutMs);
  if (state === "zero") return [];
  const extracted: unknown = await page.$$eval(cardSelector, (cards, maximum) =>
    cards.slice(0, maximum).map((card) => {
      const element = card as HTMLElement;
      const image = element.querySelector<HTMLImageElement>(".img-lazy-load");
      const link = element.querySelector<HTMLAnchorElement>("a.img-lazy-load-container");
      return {
        externalId: element.dataset.inventoryitemid ?? null,
        url: link?.href ?? "",
        title: element.dataset.name ?? "",
        imageUrl: image?.src || image?.dataset.src || null,
        vin: element.dataset.vin ?? null,
        stockNumber: element.dataset.stocknumber ?? null,
        make: element.dataset.make ?? null,
        model: element.dataset.model ?? null,
        trim: element.dataset.trim ?? null,
        year: element.dataset.year ?? null,
        price: element.dataset.price ?? element.querySelector(".price-info .value")?.textContent?.trim() ?? null,
        odometer: element.querySelector(".mileage-tag .body-2")?.textContent?.trim() ?? null,
        dealerName: "Yorkdale Volkswagen",
        exteriorColor: element.dataset.color ?? null,
        transmission: element.dataset.transmission ?? null,
        drivetrain: element.dataset.drivetrain ?? null,
        engine: element.dataset.engine ?? null,
        condition: element.dataset.condition ?? "used",
      };
    }),
  limits.maxListings);
  return parseBatch("yorkdalevw", extracted, filters, limits.maxListings);
}
