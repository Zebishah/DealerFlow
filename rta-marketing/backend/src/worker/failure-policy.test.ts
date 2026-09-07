import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../lib/errors.js";
import { deliverScrapeMessage, isPermanentFailure } from "./failure-policy.js";

void test("permanent failures include blocked sources and explicit classifications", () => {
  assert.equal(isPermanentFailure(new AppError(502, "SOURCE_ACCESS_BLOCKED", "blocked")), true);
  assert.equal(isPermanentFailure(new AppError(400, "OTHER", "invalid", { retryable: false })), true);
  assert.equal(isPermanentFailure(new AppError(429, "SOURCE_RATE_LIMITED", "slow down", { retryable: true })), false);
  assert.equal(isPermanentFailure(new Error("database connection failed")), false);
});

void test("permanent failure forwards original message before acknowledging", async () => {
  const body = '{"runId":"test"}';
  const failure = new AppError(502, "SOURCE_ACCESS_BLOCKED", "blocked");
  let forwarded = false;
  await deliverScrapeMessage(body, async () => { throw failure; }, async (sent, error) => {
    assert.equal(sent, body);
    assert.equal(error, failure);
    forwarded = true;
  });
  assert.equal(forwarded, true);
});

void test("DLQ publication failure retries the original message instead of losing it", async () => {
  const outage = new Error("SQS unavailable");
  await assert.rejects(deliverScrapeMessage("{}",
    async () => { throw new AppError(502, "SOURCE_ACCESS_BLOCKED", "blocked"); },
    async () => { throw outage; }), outage);
});

void test("transient failures remain failures and are not immediately dead-lettered", async () => {
  const failure = new AppError(504, "SCRAPE_TIMEOUT", "timeout", { retryable: true });
  await assert.rejects(deliverScrapeMessage("{}", async () => { throw failure; },
    async () => { assert.fail("must not forward transient failure"); }), failure);
});

void test("successful and already-terminal jobs are acknowledged without a DLQ write", async () => {
  await deliverScrapeMessage("{}", async () => ({ skipped: true }),
    async () => { assert.fail("must not forward successful job"); });
});
