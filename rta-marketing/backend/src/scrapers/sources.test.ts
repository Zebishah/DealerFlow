import assert from "node:assert/strict";
import test from "node:test";
import { rawListingSchema } from "../contracts/listing.js";
import { sourceKeySchema } from "../contracts/scrape.js";
import { parseBatch } from "./common.js";
import { sanitizedSourceFixtures } from "./sanitized-fixtures.js";

for (const source of sourceKeySchema.options) {
  void test(`${source} sanitized extraction fixture passes strict parsing`, () => {
    const parsed = parseBatch(source, sanitizedSourceFixtures[source], {}, 10);
    assert.equal(parsed.length, 1);
    assert.equal(rawListingSchema.safeParse(parsed[0]).success, true);
    assert.equal(parsed[0]?.source, source);
  });
}
