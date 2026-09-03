// ============================================
// FILE: src/lib/normalizeCar.ts
// ============================================

import { NormalizedCar } from "../types";

export const normalizeCar = (
  raw: any,
  source: string,
  index: number
): NormalizedCar => {
  const cleanPrice = (price: string) => {
    if (!price) return "N/A";
    return price
      .replace(/\\n/g, "")
      .replace(/\+ Tax/gi, "")
      .trim();
  };

  const cleanOdometer = (odo: string) => {
    if (!odo) return undefined;
    const match = odo.match(/[\d,]+/);
    return match ? `${match[0]} KM` : odo;
  };

  const id = raw.adId || raw.vin || `${source}-${index}`;

  return {
    id: `${source}-${id}`,
    source: source.trim().toLowerCase(),
    title:
      raw.title ||
      `${raw.year || ""} ${raw.make || ""} ${raw.model || ""}`.trim(),
    price: cleanPrice(raw.price),
    image: raw.image || "/placeholder.jpg",
    link: raw.link || "#",
    year: raw.year?.toString(),
    odometer: cleanOdometer(raw.odometer),
    location: raw.location || raw.proximity,
    dealer: raw.dealer,
    isUsed: true,
  };
};
