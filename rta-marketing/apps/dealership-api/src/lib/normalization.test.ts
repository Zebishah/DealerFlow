import assert from "node:assert/strict";
import test from "node:test";
import { normalizeListing } from "./normalization.js";
import { rawListingSchema } from "../contracts/listing.js";
import { getFixtureListings } from "../worker/fixtures.js";

void test("normalizes money, mileage, VIN and condition", () => {
  const result = normalizeListing({
    externalId: " at-123 ", source: "autotrader", url: "https://example.com/123",
    title: " 2022   Volkswagen Golf ", imageUrl: null, vin: "3vw2k7aj5em388202",
    stockNumber: null, make: "Volkswagen", model: "Golf", trim: "Comfortline", year: 2022,
    price: "$31,995", odometer: "41,200 km", currency: "cad", dealerName: " RTA Motors ",
    location: "Toronto, ON", bodyStyle: "Hatchback", transmission: "Automatic",
    drivetrain: "FWD", engine: "2.0L", exteriorColor: "White", condition: "used",
  });
  assert.equal(result.externalId, "at-123");
  assert.equal(result.priceCents, 3_199_500);
  assert.equal(result.odometerKm, 41_200);
  assert.equal(result.vin, "3VW2K7AJ5EM388202");
  assert.equal(result.isUsed, true);
});

void test("preserves decimal prices and mileage shorthand", () => {
  const result = normalizeListing({
    externalId: "decimal-1", source: "autotrader", url: "https://example.com/decimal-1",
    title: "2024 Honda Civic Touring", make: "Honda", model: "Civic", year: 2024,
    price: "$31,995.50", odometer: "41.2k km", currency: "CAD", condition: "used",
  });
  assert.equal(result.priceCents, 3_199_550);
  assert.equal(result.odometerKm, 41_200);
});

void test("does not force new vehicles to used", () => {
  const result = normalizeListing({
    externalId: "new-1", source: "autoplanet", url: "https://example.com/new-1", title: "2026 Honda Civic",
    make: "Honda", model: "Civic", year: 2026, currency: "CAD", condition: "new",
  });
  assert.equal(result.isUsed, false);
});

void test("all public demo fixtures satisfy the raw source contract", () => {
  for (const source of ["autotrader", "autoplanet", "humberview", "yorkdalevw"] as const) {
    for (const listing of getFixtureListings(source)) assert.equal(rawListingSchema.safeParse(listing).success, true);
  }
});
