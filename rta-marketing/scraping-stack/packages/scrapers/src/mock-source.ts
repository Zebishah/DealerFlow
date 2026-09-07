import { validateItem, type ScraperOptions } from "./common.js";
import type { ScrapedItem, SiteConfig } from "@rta/shared";

const SEED = 20260907;
const makes = ["Toyota", "Honda", "Suzuki", "KIA", "Hyundai", "Changan"];
const models = ["Corolla", "Civic", "Alto", "Sportage", "City", "Tucson", "Alsvin"];
const cities = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Multan"];

function seededNumber(index: number, min: number, max: number): number {
  const value = Math.abs(Math.sin(SEED + index * 97.13));
  return Math.floor(min + value * (max - min + 1));
}

export async function scrapeSyntheticSource(site: SiteConfig, _options: ScraperOptions): Promise<ScrapedItem[]> {
  return Array.from({ length: 20 }, (_unused, index) => {
    const make = makes[seededNumber(index, 0, makes.length - 1)] ?? makes[0];
    const model = models[seededNumber(index + 1, 0, models.length - 1)] ?? models[0];
    const year = String(seededNumber(index + 2, 2015, 2025));
    const mileage = `${seededNumber(index + 3, 10, 180) * 1000} km`;
    const title = `${make} ${model} ${year}`;
    const listingUrl = `https://demo.synthetic.invalid/listings/vehicle-${index + 1}`;
    const thumbnailUrl = `https://images.synthetic.invalid/vehicle-${index + 1}.jpg`;
    return validateItem(site, {
      title,
      price: `PKR ${seededNumber(index + 4, 15, 95)} lacs`,
      year,
      mileage,
      city: cities[seededNumber(index + 5, 0, cities.length - 1)] ?? cities[0],
      listingUrl,
      thumbnailUrl,
      rawData: { source: "synthetic", generator: "deterministic-seed", seed: SEED, index, title, year, mileage, listingUrl, thumbnailUrl },
    });
  }).filter((item): item is ScrapedItem => item !== null);
}
