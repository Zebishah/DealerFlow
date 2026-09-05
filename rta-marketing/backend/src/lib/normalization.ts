import { createHash } from "node:crypto";
import type { CanonicalListing, RawListing } from "../contracts/listing.js";

function cleanText(value: string | null | undefined): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned : null;
}

function parseInteger(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  if (!value) return null;
  const normalized = value.replace(/,/g, "").trim().toLowerCase();
  const shorthand = normalized.match(/^(-?[\d.]+)\s*k(?:\s*km)?$/);
  const parsed = shorthand
    ? Number(shorthand[1]) * 1_000
    : Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseMoneyCents(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }
  if (!value) return null;
  const parsed = Number(value.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

function normalizeVin(value: string | null | undefined): string | null {
  if (!value) return null;
  const vin = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : null;
}

function fingerprint(parts: Array<string | number | null>): string {
  return createHash("sha256")
    .update(parts.map((part) => String(part ?? "").trim().toLowerCase()).join("|"))
    .digest("hex");
}

export function normalizeListing(raw: RawListing): CanonicalListing {
  const make = raw.make.trim();
  const model = raw.model.trim();
  const trim = cleanText(raw.trim);
  const vin = normalizeVin(raw.vin);
  const priceCents = parseMoneyCents(raw.price);

  return {
    externalId: raw.externalId.trim(),
    source: raw.source,
    url: raw.url,
    title: raw.title.replace(/\s+/g, " ").trim(),
    imageUrl: cleanText(raw.imageUrl),
    vin,
    fingerprint: fingerprint([
      make,
      model,
      raw.year,
      trim,
      raw.bodyStyle ?? null,
      raw.engine ?? null,
    ]),
    make,
    model,
    trim,
    year: raw.year,
    priceCents,
    odometerKm: parseInteger(raw.odometer),
    currency: raw.currency.toUpperCase(),
    dealerName: cleanText(raw.dealerName),
    location: cleanText(raw.location),
    bodyStyle: cleanText(raw.bodyStyle),
    transmission: cleanText(raw.transmission),
    drivetrain: cleanText(raw.drivetrain),
    engine: cleanText(raw.engine),
    exteriorColor: cleanText(raw.exteriorColor),
    isUsed: raw.condition !== "new",
  };
}
