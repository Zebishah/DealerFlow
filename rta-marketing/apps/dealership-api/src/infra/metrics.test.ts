import assert from "node:assert/strict";
import test from "node:test";
import { incrementMetric, metricsSummary, observeAiProvider, observeRequest, resetMetricsForTests } from "./metrics.js";

void test("metrics summarize request latency, cache hit rate, provider failures, and no secret-bearing fields", () => {
  resetMetricsForTests();
  observeRequest(200, 10);
  observeRequest(429, 30);
  incrementMetric("cache_hits", 3);
  incrementMetric("cache_misses", 1);
  observeAiProvider("gemini", "failure");
  observeAiProvider("groq", "success");
  const summary = metricsSummary();
  assert.equal(summary.requests.total, 2);
  assert.equal(summary.requests.rateLimitRejections, 1);
  assert.equal(summary.redis.cacheHitRate, 0.75);
  assert.equal(summary.ai.providerFailures, 1);
  assert.equal(summary.ai.providers.gemini?.failures, 1);
  assert.equal(JSON.stringify(summary).includes("DATABASE_URL"), false);
  assert.equal(JSON.stringify(summary).includes("password"), false);
  resetMetricsForTests();
});
