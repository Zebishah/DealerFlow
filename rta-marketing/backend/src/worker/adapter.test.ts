import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../lib/errors.js";
import { adaptLegacyListing } from "./adapter.js";

void test("legacy adapter preserves source identity and vehicle condition", () => {
  const listing = adaptLegacyListing(
    "autoplanet",
    {
      stockNumber: "STOCK-42",
      title: "2024 Mazda CX-5 GT",
      link: "https://dealer.example/vehicles/42",
      year: "2024",
      make: "Mazda",
      model: "CX-5",
      isUsed: false,
      price: "$38,500",
      odometer: "125 KM",
    },
    {},
  );

  assert.equal(listing.externalId, "STOCK-42");
  assert.equal(listing.source, "autoplanet");
  assert.equal(listing.year, 2024);
  assert.equal(listing.make, "Mazda");
  assert.equal(listing.model, "CX-5");
  assert.equal(listing.condition, "new");
  assert.equal(listing.currency, "CAD");
});

void test("legacy adapter derives a stable ID from URL instead of array order", () => {
  const input = {
    title: "2021 Toyota RAV4 XLE",
    link: "https://dealer.example/vehicles/rav4-xle",
    isUsed: true,
  };
  const first = adaptLegacyListing("autotrader", input, {});
  const second = adaptLegacyListing("autotrader", input, {});

  assert.equal(first.externalId, second.externalId);
  assert.equal(first.externalId.length, 32);
  assert.equal(first.condition, "used");
});

void test("legacy adapter rejects records without durable identity", () => {
  assert.throws(
    () =>
      adaptLegacyListing(
        "humberview",
        { title: "2022 Volkswagen Tiguan" },
        {},
      ),
    (error: unknown) =>
      error instanceof AppError && error.code === "LISTING_ID_MISSING",
  );
});
