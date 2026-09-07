import { AppError } from "../lib/errors.js";

const permanentCodes = new Set([
  "SOURCE_ACCESS_BLOCKED", "SOURCE_FILTERS_UNSUPPORTED", "SOURCE_URL_BUILDER_MISSING",
  "SOURCE_SELECTOR_MISMATCH", "SOURCE_PAYLOAD_INVALID", "LIVE_SCRAPING_DISABLED",
  "BROWSER_EXECUTABLE_REQUIRED", "BROWSER_PROXY_INVALID",
]);

export function isPermanentFailure(error: unknown): boolean {
  if (!(error instanceof AppError)) return false;
  const details = error.details as { retryable?: unknown } | undefined;
  return details?.retryable === false || permanentCodes.has(error.code);
}

export function isPermanentCode(code: string | null): boolean {
  return code !== null && permanentCodes.has(code);
}

/** Acknowledge only after successful processing or durable DLQ publication. */
export async function deliverScrapeMessage(
  body: string,
  process: (input: unknown) => Promise<unknown>,
  forwardToDlq: (body: string, error: AppError) => Promise<void>,
): Promise<void> {
  try {
    await process(JSON.parse(body) as unknown);
  } catch (error) {
    if (!isPermanentFailure(error)) throw error;
    await forwardToDlq(body, error as AppError);
  }
}
