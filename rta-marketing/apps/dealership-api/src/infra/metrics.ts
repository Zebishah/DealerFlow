import type { NextFunction, Request, RequestHandler, Response } from "express";

type MetricName =
  | "db_errors"
  | "redis_failures"
  | "cache_hits"
  | "cache_misses"
  | "rate_limit_rejections"
  | "apify_dispatch_attempts"
  | "apify_dispatch_failures"
  | "apify_runs_succeeded"
  | "apify_runs_failed"
  | "ai_requests"
  | "ai_provider_failures"
  | "ai_fallbacks"
  | "ai_timeouts";

type ProviderName = "gemini" | "groq" | "openrouter" | "openai-compatible" | "deterministic";

const startedAt = Date.now();
const counters = new Map<MetricName, number>();
const providerRequests = new Map<ProviderName, number>();
const providerFailures = new Map<ProviderName, number>();
const latencySamples: number[] = [];
const MAX_LATENCY_SAMPLES = 2_000;
let requestTotal = 0;

function incrementMap(map: Map<string, number>, key: string, amount = 1): void {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function incrementMetric(name: MetricName, amount = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + amount);
}

export function observeRequest(statusCode: number, durationMs: number): void {
  requestTotal += 1;
  latencySamples.push(Math.max(0, Math.round(durationMs)));
  if (latencySamples.length > MAX_LATENCY_SAMPLES) latencySamples.shift();
  if (statusCode >= 400 && statusCode < 500) incrementMetric("rate_limit_rejections", statusCode === 429 ? 1 : 0);
}

export function observeAiRequest(provider: ProviderName, outcome: "success" | "failure" | "fallback" | "timeout"): void {
  incrementMetric("ai_requests");
  observeAiProvider(provider, outcome === "timeout" ? "timeout" : outcome === "failure" ? "failure" : "success");
  if (outcome === "fallback") incrementMetric("ai_fallbacks");
}

export function observeAiProvider(provider: ProviderName, outcome: "success" | "failure" | "timeout"): void {
  incrementMap(providerRequests, provider);
  if (outcome === "failure" || outcome === "timeout") {
    incrementMetric(outcome === "timeout" ? "ai_timeouts" : "ai_provider_failures");
    incrementMap(providerFailures, provider);
  }
}

export function requestMetricsMiddleware(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    const started = Date.now();
    response.once("finish", () => observeRequest(response.statusCode, Date.now() - started));
    next();
  };
}

function percentile(values: readonly number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? null;
}

export function metricsSummary() {
  const cacheHits = counters.get("cache_hits") ?? 0;
  const cacheMisses = counters.get("cache_misses") ?? 0;
  const cacheTotal = cacheHits + cacheMisses;
  return {
    window: { startedAt: new Date(startedAt).toISOString(), scope: "current_api_process" },
    requests: {
      total: requestTotal,
      latencyMs: {
        p50: percentile(latencySamples, 0.5),
        p95: percentile(latencySamples, 0.95),
      },
      rateLimitRejections: counters.get("rate_limit_rejections") ?? 0,
    },
    database: { errors: counters.get("db_errors") ?? 0 },
    redis: {
      failures: counters.get("redis_failures") ?? 0,
      cacheHits,
      cacheMisses,
      cacheHitRate: cacheTotal ? Number((cacheHits / cacheTotal).toFixed(3)) : null,
    },
    apify: {
      dispatchAttempts: counters.get("apify_dispatch_attempts") ?? 0,
      dispatchFailures: counters.get("apify_dispatch_failures") ?? 0,
      successfulRuns: counters.get("apify_runs_succeeded") ?? 0,
      failedRuns: counters.get("apify_runs_failed") ?? 0,
    },
    ai: {
      requests: counters.get("ai_requests") ?? 0,
      providerFailures: counters.get("ai_provider_failures") ?? 0,
      fallbacks: counters.get("ai_fallbacks") ?? 0,
      timeouts: counters.get("ai_timeouts") ?? 0,
      providers: Object.fromEntries([...providerRequests.keys()].sort().map((provider) => [provider, {
        requests: providerRequests.get(provider) ?? 0,
        failures: providerFailures.get(provider) ?? 0,
      }])),
    },
  };
}

export function resetMetricsForTests(): void {
  counters.clear();
  providerRequests.clear();
  providerFailures.clear();
  latencySamples.length = 0;
  requestTotal = 0;
}
