import assert from "node:assert/strict";
import test from "node:test";
import { rawListingSchema } from "../contracts/listing.js";
import { AppError } from "../lib/errors.js";
<<<<<<< Updated upstream
import { parseBatch, toRawListing } from "../scrapers/common.js";
=======
<<<<<<< HEAD
import { buildUrl as buildAutoPlanetUrl } from "../../services/url-builders/autoPlanet.builder.js";
import { buildUrl as buildAutoTraderUrl } from "../../services/url-builders/autotrader.builder.js";
import { buildUrl as buildHumberviewUrl } from "../../services/url-builders/humberview.builder.js";
import { buildUrl as buildYorkdaleUrl } from "../../services/url-builders/yorkdalevw.builder.js";
import { adaptLegacyListing } from "./adapter.js";
import { legacyAdapterFixtures } from "./legacy-adapter.fixtures.js";

void test("all typed source URL builders produce valid source URLs", () => {
  const filters = { make: "Volkswagen", model: "Tiguan" };
  const urls = [
    buildAutoTraderUrl(filters),
    buildAutoPlanetUrl(filters),
    buildHumberviewUrl(filters),
    buildYorkdaleUrl(filters),
  ];

  for (const value of urls) {
    assert.ok(value);
    assert.equal(new URL(value).protocol, "https:");
  }
});

void test("all source parser boundary fixtures normalize into the raw listing contract", () => {
  for (const fixture of legacyAdapterFixtures) {
    const listing = adaptLegacyListing(fixture.source, fixture.record, {});
    assert.deepEqual(
      {
        externalId: listing.externalId,
        make: listing.make,
        model: listing.model,
        year: listing.year,
        condition: listing.condition,
      },
      fixture.expected,
    );
    assert.equal(rawListingSchema.safeParse(listing).success, true, fixture.source);
  }
});

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
=======
import { parseBatch, toRawListing } from "../scrapers/common.js";
>>>>>>> 587b15eead1d6b04a3a3062aa8e506cef0d2aab8
>>>>>>> Stashed changes

void test("strict source adapter preserves identity and condition", () => {
  const listing = toRawListing("autoplanet", {
    externalId: "STOCK-42",
    title: "2024 Mazda CX-5 GT",
    url: "https://dealer.example/vehicles/42",
    year: "2024",
    make: "Mazda",
    model: "CX-5",
    condition: "new",
    price: "$38,500",
    odometer: "125 KM",
  }, {});
  assert.equal(listing.externalId, "STOCK-42");
  assert.equal(listing.year, 2024);
  assert.equal(listing.condition, "new");
});

void test("strict source adapter derives a stable ID from URL", () => {
  const input = {
    title: "2021 Toyota RAV4 XLE",
    url: "https://dealer.example/vehicles/rav4-xle",
    condition: "used",
  };
  const first = toRawListing("autotrader", input, {});
  const second = toRawListing("autotrader", input, {});
  assert.equal(first.externalId, second.externalId);
  assert.equal(first.externalId.length, 32);
});

void test("strict source adapter rejects unknown fields", () => {
  assert.throws(
    () => parseBatch("humberview", [{
      title: "2022 Volkswagen Tiguan",
      url: "https://dealer.example/tiguan",
      unexpected: true,
    }], {}, 10),
    (error: unknown) => error instanceof AppError && error.code === "SOURCE_PAYLOAD_INVALID",
  );
});
