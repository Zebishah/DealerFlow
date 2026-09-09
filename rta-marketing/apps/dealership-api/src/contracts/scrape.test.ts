import assert from "node:assert/strict";
import test from "node:test";
import { createScrapeRunSchema } from "./scrape.js";

void test("accepts a bounded fixture request", () => {
  const parsed = createScrapeRunSchema.parse({ filters: { make: "Volkswagen", minYear: 2020 }, mode: "fixture" });
  assert.equal(parsed.mode, "fixture");
});

void test("rejects inverted ranges and unknown fields", () => {
  assert.equal(createScrapeRunSchema.safeParse({ filters: { minPrice: 50_000, maxPrice: 20_000 } }).success, false);
  assert.equal(createScrapeRunSchema.safeParse({ filters: {}, admin: true }).success, false);
});
