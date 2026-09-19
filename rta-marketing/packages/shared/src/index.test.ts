import assert from "node:assert/strict";
import test from "node:test";
import { appConfigSchema, legacyWorkerWriteGuard } from "./index.js";

void test("legacy worker writes are disabled by default", () => {
  const config = appConfigSchema.parse({ DATABASE_URL: "https://example.com/neon" });
  assert.deepEqual(legacyWorkerWriteGuard(config), { allowed: false, exitCode: 0, reason: "disabled" });
});

void test("legacy production writes require two explicit opt-ins", () => {
  const config = appConfigSchema.parse({ DATABASE_URL: "https://example.com/neon", NODE_ENV: "production", ENABLE_LEGACY_WORKER: "true" });
  assert.deepEqual(legacyWorkerWriteGuard(config), { allowed: false, exitCode: 1, reason: "production-writes-not-approved" });
  assert.equal(legacyWorkerWriteGuard({ ...config, ALLOW_LEGACY_PRODUCTION_WRITES: true }).allowed, true);
});
