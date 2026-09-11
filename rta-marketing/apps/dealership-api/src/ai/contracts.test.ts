import assert from "node:assert/strict";
import test from "node:test";
import { assistantRequestSchema } from "./contracts.js";

void test("assistant requests stay bounded and normalize defaults", () => {
  const request = assistantRequestSchema.parse({ message: "  summarize this page  " });
  assert.equal(request.message, "summarize this page");
  assert.deepEqual(request.history, []);
});

void test("assistant request rejects oversized conversation history", () => {
  const result = assistantRequestSchema.safeParse({
    message: "hello",
    history: Array.from({ length: 13 }, () => ({ role: "user", content: "hello" })),
  });
  assert.equal(result.success, false);
});
