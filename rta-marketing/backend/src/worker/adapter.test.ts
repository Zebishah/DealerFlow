import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../lib/errors.js";
import { parseBatch, toRawListing } from "../scrapers/common.js";

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
