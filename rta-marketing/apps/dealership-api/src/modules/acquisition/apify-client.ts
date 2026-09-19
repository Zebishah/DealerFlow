import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { incrementMetric } from "../../infra/metrics.js";
import { isTransientHttpStatus, isTransientNetworkError, retryWithBackoff } from "../../infra/resilience.js";
import type { ApifySiteKey } from "./source-mapping.js";

export type ApifyErrorKind = "timeout" | "network" | "credentials" | "not-found" | "rate-limited" | "upstream" | "malformed";
export type ApifyRunStatus = "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMING-OUT" | "TIMED-OUT" | "ABORTING" | "ABORTED" | string;

export interface ApifyRun {
  id: string;
  status: ApifyRunStatus;
  statusMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  defaultKeyValueStoreId?: string | null;
  defaultDatasetId?: string | null;
}

export interface ApifyOutputMetadata {
  requestedCount?: number;
  foundCount?: number;
  durationMs?: number;
  recordsDiscovered?: number;
  recordsAccepted?: number;
  recordsRejected?: number;
  parserVersion?: string;
  timings?: Record<string, number>;
}

export class ApifyClientError extends Error {
  constructor(
    message: string,
    readonly kind: ApifyErrorKind,
    readonly statusCode?: number,
    readonly operation?: string,
  ) {
    super(message);
    this.name = "ApifyClientError";
  }
}

function isRetryableApifyError(error: unknown): boolean {
  if (!(error instanceof ApifyClientError)) return isTransientNetworkError(error);
  return error.kind === "timeout" || error.kind === "network" || error.kind === "rate-limited"
    || (error.kind === "upstream" && error.statusCode !== undefined && isTransientHttpStatus(error.statusCode));
}

interface ApifyClientOptions {
  token: string;
  actorId: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function runFromPayload(payload: unknown, operation: string): ApifyRun {
  const root = objectValue(payload);
  const data = objectValue(root?.data);
  if (!data || typeof data.id !== "string" || typeof data.status !== "string") {
    throw new ApifyClientError("Apify returned an invalid run payload", "malformed", undefined, operation);
  }
  return {
    id: data.id,
    status: data.status,
    statusMessage: typeof data.statusMessage === "string" ? data.statusMessage : null,
    startedAt: typeof data.startedAt === "string" ? data.startedAt : null,
    finishedAt: typeof data.finishedAt === "string" ? data.finishedAt : null,
    defaultKeyValueStoreId: typeof data.defaultKeyValueStoreId === "string" ? data.defaultKeyValueStoreId : null,
    defaultDatasetId: typeof data.defaultDatasetId === "string" ? data.defaultDatasetId : null,
  };
}

function errorKindForStatus(status: number): ApifyErrorKind {
  if (status === 401 || status === 403) return "credentials";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  return "upstream";
}

export function mapApifyStatus(status: ApifyRunStatus): "queued" | "scraping" | "completed" | "failed" | "cancelled" {
  switch (status) {
    case "READY": return "queued";
    case "RUNNING": return "scraping";
    case "SUCCEEDED": return "completed";
    case "ABORTING":
    case "ABORTED": return "cancelled";
    case "FAILED":
    case "TIMING-OUT":
    case "TIMED-OUT": return "failed";
    default: return "failed";
  }
}

export class ApifyClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: ApifyClientOptions) {
    this.baseUrl = (options.baseUrl ?? env.APIFY_API_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? env.APIFY_RUN_TIMEOUT_SECONDS * 1_000;
  }

  private async requestOnce(path: string, init: RequestInit, operation: string, siteKey?: ApifySiteKey): Promise<unknown> {
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${this.options.token}`, ...init.headers },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError" || error instanceof Error && (error.name === "AbortError" || /timeout/i.test(error.message));
      const kind: ApifyErrorKind = timedOut ? "timeout" : "network";
      logger.warn({ siteKey, operation, elapsedMs: Date.now() - startedAt, mappedStatus: kind }, "Apify request failed");
      throw new ApifyClientError(timedOut ? "Apify request timed out" : "Apify request could not be reached", kind, undefined, operation);
    }
    logger.info({ siteKey, operation, status: response.status, elapsedMs: Date.now() - startedAt, mappedStatus: response.ok ? "ok" : errorKindForStatus(response.status) }, "Apify request completed");
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new ApifyClientError("Apify rejected the request", errorKindForStatus(response.status), response.status, operation);
    if (payload === null) throw new ApifyClientError("Apify returned an invalid JSON payload", "malformed", response.status, operation);
    return payload;
  }

  private async request(path: string, init: RequestInit, operation: string, siteKey?: ApifySiteKey): Promise<unknown> {
    // GET status/output calls are safe to retry. A POST run creation is deliberately
    // single-attempt because a timeout leaves its remote outcome uncertain.
    const retryable = init.method?.toUpperCase() === "GET";
    return retryWithBackoff(
      () => this.requestOnce(path, init, operation, siteKey),
      {
        maxAttempts: retryable ? 3 : 1,
        baseDelayMs: 150,
        maxDelayMs: 1_000,
        shouldRetry: isRetryableApifyError,
      },
    );
  }

  async startRun(siteKey: ApifySiteKey, limit: number): Promise<ApifyRun> {
    incrementMetric("apify_dispatch_attempts");
    const actorId = encodeURIComponent(this.options.actorId);
    try {
      const payload = await this.request(`/acts/${actorId}/runs`, { method: "POST", body: JSON.stringify({ siteKey, limit }) }, "start-run", siteKey);
      const run = runFromPayload(payload, "start-run");
      return run;
    } catch (error) {
      incrementMetric("apify_dispatch_failures");
      throw error;
    }
  }

  async getRun(runId: string, siteKey?: ApifySiteKey): Promise<ApifyRun> {
    const payload = await this.request(`/actor-runs/${encodeURIComponent(runId)}`, { method: "GET" }, "get-run", siteKey);
    return runFromPayload(payload, "get-run");
  }

  async getOutput(run: ApifyRun, siteKey?: ApifySiteKey): Promise<ApifyOutputMetadata> {
    if (!run.defaultKeyValueStoreId) throw new ApifyClientError("Apify run did not expose its output store", "malformed", undefined, "get-output");
    const payload = await this.request(`/key-value-stores/${encodeURIComponent(run.defaultKeyValueStoreId)}/records/OUTPUT`, { method: "GET" }, "get-output", siteKey);
    const root = objectValue(payload);
    const values = objectValue(root?.value) ?? root;
    if (!values) throw new ApifyClientError("Apify returned an invalid output payload", "malformed", undefined, "get-output");
    const numberValue = (key: string): number | undefined => typeof values[key] === "number" && Number.isFinite(values[key]) ? values[key] as number : undefined;
    const timings = objectValue(values.timings);
    const output: ApifyOutputMetadata = {};
    const requestedCount = numberValue("requestedCount");
    const foundCount = numberValue("foundCount");
    const durationMs = numberValue("durationMs");
    const recordsDiscovered = numberValue("recordsDiscovered");
    const recordsAccepted = numberValue("recordsAccepted");
    const recordsRejected = numberValue("recordsRejected");
    const parserVersion = typeof values.parserVersion === "string" && values.parserVersion.length <= 100 ? values.parserVersion : undefined;
    if (requestedCount !== undefined) output.requestedCount = requestedCount;
    if (foundCount !== undefined) output.foundCount = foundCount;
    if (durationMs !== undefined) output.durationMs = durationMs;
    if (recordsDiscovered !== undefined) output.recordsDiscovered = recordsDiscovered;
    if (recordsAccepted !== undefined) output.recordsAccepted = recordsAccepted;
    if (recordsRejected !== undefined) output.recordsRejected = recordsRejected;
    if (parserVersion !== undefined) output.parserVersion = parserVersion;
    if (timings) output.timings = Object.fromEntries(Object.entries(timings).filter(([, value]) => typeof value === "number" && Number.isFinite(value)).map(([key, value]) => [key, value as number]));
    return output;
  }
}

export function requireApifyClient(): ApifyClient {
  if (!env.APIFY_API_TOKEN || !env.APIFY_ACTOR_ID) {
    throw new ApifyClientError("Apify integration credentials are not configured", "credentials");
  }
  return new ApifyClient({ token: env.APIFY_API_TOKEN, actorId: env.APIFY_ACTOR_ID });
}
