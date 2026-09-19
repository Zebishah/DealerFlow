export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  shouldRetry?: (error: unknown) => boolean;
  onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

const defaultSleep = (delayMs: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, delayMs));

export async function retryWithBackoff<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts));
  const jitterRatio = Math.max(0, Math.min(1, options.jitterRatio ?? 0.2));
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || options.shouldRetry?.(error) === false) throw error;
      const exponential = Math.min(options.maxDelayMs, options.baseDelayMs * (2 ** (attempt - 1)));
      const jitter = exponential * jitterRatio * (random() * 2 - 1);
      const delayMs = Math.max(0, Math.round(exponential + jitter));
      options.onRetry?.(attempt, delayMs, error);
      await sleep(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Retry operation failed");
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

export function isTransientNetworkError(error: unknown): boolean {
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
  const text = `${candidate?.name ?? ""} ${candidate?.code ?? ""} ${candidate?.message ?? ""}`;
  return /AbortError|TimeoutError|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|fetch failed|network/i.test(text);
}
