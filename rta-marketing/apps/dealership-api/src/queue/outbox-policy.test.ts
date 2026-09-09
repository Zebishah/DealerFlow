import assert from "node:assert/strict";
import test from "node:test";
import { outboxRetryDelaySeconds } from "./outbox-policy.js";

void test("outbox retry uses bounded exponential backoff", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 20].map(outboxRetryDelaySeconds), [5, 10, 20, 40, 80, 160, 300, 300]);
});
