import assert from "node:assert/strict";
import test from "node:test";
import { buildSourceHealth, deriveOperationalStatus, deriveSourceHealth } from "./service.js";

const date = (value: string) => new Date(value);

void test("source health is healthy after a recent successful run", () => {
  const rows = [{ siteKey: "romans-international", status: "completed", foundCount: 5, recordsDiscovered: 7, recordsAccepted: 5, recordsRejected: 2, parserVersion: "romans-international:v3", durationMs: 800, finishedAt: date("2026-09-19T00:59:00.000Z"), createdAt: date("2026-09-19T00:58:00.000Z") }];
  assert.equal(deriveSourceHealth(rows, Date.parse("2026-09-19T01:00:00.000Z")), "healthy");
  assert.equal(buildSourceHealth(rows, Date.parse("2026-09-19T01:00:00.000Z"))[0]?.recordsAccepted, 5);
  assert.equal(buildSourceHealth(rows, Date.parse("2026-09-19T01:00:00.000Z"))[0]?.recordsDiscovered, 7);
  assert.equal(buildSourceHealth(rows, Date.parse("2026-09-19T01:00:00.000Z"))[0]?.recordsRejected, 2);
  assert.equal(buildSourceHealth(rows, Date.parse("2026-09-19T01:00:00.000Z"))[0]?.parserVersion, "romans-international:v3");
  assert.equal(buildSourceHealth(rows, Date.parse("2026-09-19T01:00:00.000Z"))[1]?.status, "unknown");
});

void test("source health becomes failing after three consecutive failures", () => {
  const rows = [0, 1, 2].map((offset) => ({ siteKey: "tom-hartley", status: "failed", foundCount: null, durationMs: 100, finishedAt: date(`2026-09-19T00:0${9 - offset}:00.000Z`), createdAt: date(`2026-09-19T00:0${9 - offset}:00.000Z`) }));
  assert.equal(deriveSourceHealth(rows, Date.parse("2026-09-19T01:00:00.000Z")), "failing");
});

void test("operational health is unavailable for database failure and degraded for Redis failure", () => {
  assert.equal(deriveOperationalStatus(false, { configured: true, reachable: true }), "unavailable");
  assert.equal(deriveOperationalStatus(true, { configured: true, reachable: false }), "degraded");
  assert.equal(deriveOperationalStatus(true, { configured: false, reachable: false }), "healthy");
});
