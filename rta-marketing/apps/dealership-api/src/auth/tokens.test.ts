import assert from "node:assert/strict";
import test from "node:test";
import { createOpaqueToken, hashOpaqueToken, splitFullName } from "./tokens.js";

void test("opaque auth tokens are unpredictable and only hashes are stable", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.equal(hashOpaqueToken(first), hashOpaqueToken(first));
  assert.notEqual(hashOpaqueToken(first), first);
  assert.notEqual(hashOpaqueToken(first), hashOpaqueToken(second));
});

void test("full names are split without losing the first name", () => {
  assert.deepEqual(splitFullName("  Ada Lovelace  "), { firstName: "Ada", lastName: "Lovelace" });
  assert.deepEqual(splitFullName("Grace"), { firstName: "Grace", lastName: null });
});
