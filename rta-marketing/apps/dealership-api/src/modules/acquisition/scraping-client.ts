import { logger } from "../../lib/logger.js";

export const SCRAPING_API_WARMUP_BUDGET_MS = 55_000;
export const SCRAPING_API_REQUEST_TIMEOUT_MS = 12_000;
export const SCRAPING_API_RETRY_DELAYS_MS = [0, 2_000, 4_000, 8_000, 16_000, 25_000] as const;

export type ScrapingApiPayload = {
  data?: {
    jobId?: string | null;
    activeJob?: Record<string, unknown> | null;
    defaultLimit?: number;
    maxLimit?: number;
    retryAfterSeconds?: number;
    serviceStatus?: "available" | "active" | "waking" | "upstream-error" | "credential-rejected";
  };
  error?: string;
};

export class ScrapingApiTransportError extends Error {
  constructor(
    message: string,
    public readonly pathCategory: string,
    public readonly attempt: number,
    public readonly elapsedMs: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScrapingApiTransportError";
  }
}

export interface ScrapingApiCallOptions {
  baseUrl: string;
  token: string;
  path: string;
  init?: RequestInit;
  pathCategory: string;
  retryTransient?: boolean;
  warmupBudgetMs?: number;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
}

function isTransientTransportError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return false;
  const candidate = error as { code?: string; name?: string; message?: string };
  const text = `${candidate.code ?? ""} ${candidate.name ?? ""} ${candidate.message ?? ""}`;
  return /AbortError|TimeoutError|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|fetch failed|network/i.test(text);
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function callScrapingApi(options: ScrapingApiCallOptions): Promise<{ response: Response; payload: ScrapingApiPayload | null; attempt: number; elapsedMs: number }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const budgetMs = options.warmupBudgetMs ?? SCRAPING_API_WARMUP_BUDGET_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? SCRAPING_API_REQUEST_TIMEOUT_MS;
  const retryTransient = options.retryTransient === true;
  let lastError: unknown;

  for (let attempt = 1; attempt <= SCRAPING_API_RETRY_DELAYS_MS.length; attempt += 1) {
    const delayMs = SCRAPING_API_RETRY_DELAYS_MS.at(attempt - 1) ?? 0;
    const elapsedBeforeAttempt = now() - startedAt;
    const remainingBeforeAttempt = budgetMs - elapsedBeforeAttempt;
    if (remainingBeforeAttempt <= 0 || (delayMs > 0 && delayMs >= remainingBeforeAttempt)) break;
    if (delayMs > 0) await sleep(delayMs);

    const elapsedBeforeRequest = now() - startedAt;
    const remainingBeforeRequest = budgetMs - elapsedBeforeRequest;
    if (remainingBeforeRequest <= 0) break;
    const timeoutMs = Math.min(requestTimeoutMs, remainingBeforeRequest);
    const requestSignal = AbortSignal.timeout(timeoutMs);
    const signal = options.init?.signal ? AbortSignal.any([options.init.signal, requestSignal]) : requestSignal;
    const headers = new Headers(options.init?.headers);
    headers.set("Authorization", `Bearer ${options.token}`);

    try {
      const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}${options.path}`, { ...options.init, headers, signal });
      const elapsedMs = now() - startedAt;
      logger.info({ pathCategory: options.pathCategory, attempt, elapsedMs, status: response.status }, "scraping API upstream response");
      const payload = await response.clone().json().catch(() => null) as ScrapingApiPayload | null;
      if (attempt > 1) logger.info({ pathCategory: options.pathCategory, attempt, elapsedMs }, "scraping API cold-start recovery succeeded");
      return { response, payload, attempt, elapsedMs };
    } catch (error) {
      lastError = error;
      const elapsedMs = now() - startedAt;
      const transient = isTransientTransportError(error, options.init?.signal ?? undefined);
      logger.warn({ pathCategory: options.pathCategory, attempt, elapsedMs, timeoutMs, transient, errorName: error instanceof Error ? error.name : "unknown" }, "scraping API upstream request failed");
      if (!retryTransient || !transient) {
        throw new ScrapingApiTransportError("scraping API request failed", options.pathCategory, attempt, elapsedMs, error);
      }
    }
  }

  const elapsedMs = now() - startedAt;
  throw new ScrapingApiTransportError("scraping API warm-up window expired", options.pathCategory, SCRAPING_API_RETRY_DELAYS_MS.length, elapsedMs, lastError);
}
