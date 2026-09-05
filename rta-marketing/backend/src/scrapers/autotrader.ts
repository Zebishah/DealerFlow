import type { Page } from "puppeteer-core";
import type { RawListing } from "../contracts/listing.js";
import type { ScrapeFilters } from "../contracts/scrape.js";
import { parseBatch, waitForInventory, type ScraperLimits } from "./common.js";

const cardSelector = ".result-item.enhanced, [data-testid='listing-card'], article a[href*='/offers/']";
const stateSelector = "#titleCount, [data-testid='results-count'], main";

export async function scrapeAutoTrader(
  page: Page,
  baseUrl: string,
  filters: ScrapeFilters,
  limits: ScraperLimits,
): Promise<RawListing[]> {
  const state = await waitForInventory(page, "autotrader", cardSelector, stateSelector, limits.timeoutMs);
  if (state === "zero") return [];
  const extracted: unknown = await page.evaluate(
    ({ selector, maximum, origin }) => {
      const seen = new Set<string>();
      const values: Array<Record<string, string | null>> = [];
      for (const candidate of Array.from(document.querySelectorAll(selector))) {
        const card = candidate.closest(".result-item.enhanced, [data-testid='listing-card'], article") ?? candidate;
        const link = card.matches("a") ? card as HTMLAnchorElement : card.querySelector<HTMLAnchorElement>("a[href*='/a/'], a[href*='/offers/']");
        const url = link?.href ? new URL(link.href, origin).href : "";
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const title = card.querySelector(".result-title, .title-with-trim, h2, h3")?.textContent?.trim() ?? link?.textContent?.trim() ?? "";
        const image = card.querySelector<HTMLImageElement>("img");
        values.push({
          externalId: card.querySelector<HTMLElement>("[data-adid]")?.dataset.adid ?? url.split("/").filter(Boolean).at(-1) ?? null,
          url,
          title,
          imageUrl: image?.src || image?.dataset.src || null,
          price: card.querySelector(".price-amount, [data-testid='price']")?.textContent?.trim() ?? null,
          odometer: card.querySelector(".odometer-proximity, [data-testid='mileage']")?.textContent?.trim() ?? null,
          dealerName: card.querySelector(".seller-name, [data-testid='seller-name']")?.textContent?.trim() ?? null,
          location: Array.from(card.querySelectorAll(".proximity-text")).map((item) => item.textContent?.trim()).filter(Boolean).join(" ") || null,
          condition: "used",
        });
        if (values.length >= maximum) break;
      }
      return values;
    },
    { selector: cardSelector, maximum: limits.maxListings, origin: baseUrl },
  );
  return parseBatch("autotrader", extracted, filters, limits.maxListings);
}
