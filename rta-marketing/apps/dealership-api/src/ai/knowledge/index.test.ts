import assert from "node:assert/strict";
import test from "node:test";
import { searchKnowledge } from "./index.js";

void test("knowledge search returns grounded entries for product topics", () => {
  const results = searchKnowledge("How are scraping jobs protected?");
  assert.ok(results.some((entry) => entry.id === "scraping"));
  assert.ok(results.every((entry) => entry.content.length > 0));
});

void test("knowledge search does not fabricate an answer for unknown topics", () => {
  assert.deepEqual(searchKnowledge("quantum moon pricing 918273"), []);
});
