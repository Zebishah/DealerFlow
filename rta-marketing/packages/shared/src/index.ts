import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { RedisOptions } from "ioredis";
import { z } from "zod";
import pino from "pino";
import { assertSafeScraperUrl } from "./security.js";
export { assertSafeScraperUrl, canReleaseScrapeLock, isScrapeTokenValid, manualScrapeJobId, rateLimitDecision, SCRAPE_LOCK_KEY, SCRAPE_LOCK_REFRESH_SCRIPT, SCRAPE_LOCK_RELEASE_SCRIPT, secretsEqual } from "./security.js";

export const logger = pino({
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const siteEngineSchema = z.enum(["cheerio", "playwright"]);

// Keep one retry boundary around the whole scrape job. Crawlee gets one retry
// for a transient request failure, while BullMQ gets one retry for a failed
// worker attempt. This avoids multiplying retries inside retries.
export const SCRAPE_JOB_ATTEMPTS = 2;
export const SCRAPE_RETRY_BACKOFF_MS = 5_000;
export const SCRAPE_LOCK_SAFETY_MARGIN_MS = 10_000;

const optionalBooleanString = z.preprocess(
  (value) => value === undefined ? false : value,
  z.union([z.boolean(), z.enum(["true", "false"]).transform((entry) => entry === "true")]),
);

export const siteConfigSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  engine: siteEngineSchema,
  strategy: z.enum(["cards", "sitemap-details", "sitemap-categories"]).optional(),
  sitemapUrl: z.string().url().optional(),
  categoryPathPattern: z.string().optional(),
  itemSelector: z.string().min(1).default("[data-vehicle-card]"),
  titleSelector: z.string().min(1).default("[data-vehicle-title], h2, h3"),
  priceSelector: z.string().min(1).default("[data-vehicle-price], .price"),
  linkSelector: z.string().min(1).default("a"),
  delayMs: z.coerce.number().int().min(0).max(60000).default(2500),
  maxConcurrency: z.coerce.number().int().min(1).max(1).default(1),
});

export const scrapedItemSchema = z.object({
  title: z.string().trim().min(1).max(500),
  price: z.string().trim().max(100).nullable(),
  year: z.string().trim().max(20).nullable(),
  mileage: z.string().trim().max(100).nullable(),
  city: z.string().trim().max(200).nullable(),
  listingUrl: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  rawData: z.record(z.string(), z.unknown()).default({}),
});

export const appConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  SCRAPER_USER_AGENT: z.string().min(10).default("RTA-Portfolio-Scraper/1.0 (+https://example.com/contact)"),
  // Keep Crawlee below the B1s VM's usable memory so Node, Chromium, the OS,
  // and database/Redis clients retain headroom.
  // Keep the legacy Azure worker's established memory ceiling unchanged.
  CRAWLEE_MEMORY_MBYTES: z.coerce.number().int().min(128).max(450).default(450),
  SCRAPER_SITES_JSON: z.string().default("[]"),
  SCRAPE_DEFAULT_LIMIT: z.coerce.number().int().min(1).max(10).default(5),
  SCRAPE_MAX_LIMIT: z.coerce.number().int().min(1).max(10).default(10),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
  MANUAL_SCRAPING_ONLY: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
  ENABLE_LEGACY_WORKER: optionalBooleanString.default(false),
  ALLOW_LEGACY_PRODUCTION_WRITES: optionalBooleanString.default(false),
  SCRAPE_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(20_000),
  SCRAPE_SELECTOR_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(8_000),
  SCRAPE_JOB_TIMEOUT_MS: z.coerce.number().int().min(30_000).max(300_000).default(60_000),
  SCRAPE_LOCK_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(180),
  SCRAPE_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
  SCRAPE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(20).default(3),
  SCRAPE_AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(20).default(5),
  SCRAPE_TRIGGER_TOKEN: z.string().min(32).optional(),
  SCRAPE_ACCESS_CODE: z.string().min(16).optional(),
  SCRAPE_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(28_800),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type ScrapedItem = z.infer<typeof scrapedItemSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

export function legacyWorkerWriteGuard(config: Pick<AppConfig, "ENABLE_LEGACY_WORKER" | "ALLOW_LEGACY_PRODUCTION_WRITES" | "NODE_ENV">): { allowed: boolean; exitCode: 0 | 1; reason: "disabled" | "production-writes-not-approved" | "allowed" } {
  if (!config.ENABLE_LEGACY_WORKER) return { allowed: false, exitCode: 0, reason: "disabled" };
  if (config.NODE_ENV === "production" && !config.ALLOW_LEGACY_PRODUCTION_WRITES) return { allowed: false, exitCode: 1, reason: "production-writes-not-approved" };
  return { allowed: true, exitCode: 0, reason: "allowed" };
}

export const baseScraperConfigSchema = appConfigSchema.pick({
  NODE_ENV: true,
  DATABASE_URL: true,
  SCRAPER_USER_AGENT: true,
  CRAWLEE_MEMORY_MBYTES: true,
  SCRAPER_SITES_JSON: true,
  SCRAPE_DEFAULT_LIMIT: true,
  SCRAPE_MAX_LIMIT: true,
  SCRAPE_NAVIGATION_TIMEOUT_MS: true,
  SCRAPE_SELECTOR_TIMEOUT_MS: true,
  SCRAPE_JOB_TIMEOUT_MS: true,
}).extend({
  // Apify's bounded 4 GB container can safely use a larger Crawlee snapshot
  // budget without changing the legacy worker/API validation above.
  CRAWLEE_MEMORY_MBYTES: z.coerce.number().int().min(128).max(4096).default(450),
});

export type BaseScraperConfig = z.infer<typeof baseScraperConfigSchema> & { sites: SiteConfig[] };

function parseConfiguredSites(value: string): SiteConfig[] {
  const sites = z.array(siteConfigSchema).parse(JSON.parse(value));
  for (const site of sites) assertSafeScraperUrl(site.baseUrl);
  return sites;
}

/** Configuration shared by non-queue scraper runtimes such as Apify Actors. */
export function loadBaseScraperConfig(): BaseScraperConfig {
  const config = baseScraperConfigSchema.parse(process.env);
  if (config.SCRAPE_DEFAULT_LIMIT > config.SCRAPE_MAX_LIMIT) {
    throw new Error("SCRAPE_DEFAULT_LIMIT cannot exceed SCRAPE_MAX_LIMIT");
  }
  return { ...config, sites: parseConfiguredSites(config.SCRAPER_SITES_JSON) };
}

/** DB-only configuration keeps Actors independent from Redis/BullMQ secrets. */
export function loadDatabaseConfig(): Pick<AppConfig, "DATABASE_URL"> {
  return appConfigSchema.pick({ DATABASE_URL: true }).parse(process.env);
}

export function loadConfig(options: { requireScrapeAuth?: boolean } = {}) {
  const config = appConfigSchema.parse(process.env);
  if (options.requireScrapeAuth && config.NODE_ENV === "production" && (!config.SCRAPE_TRIGGER_TOKEN || !config.SCRAPE_ACCESS_CODE)) {
    throw new Error("SCRAPE_TRIGGER_TOKEN and SCRAPE_ACCESS_CODE are required in production");
  }
  if (options.requireScrapeAuth && config.NODE_ENV === "production" && config.CORS_ORIGIN === "*") {
    throw new Error("CORS_ORIGIN must be a specific frontend origin in production");
  }
  if (config.SCRAPE_DEFAULT_LIMIT > config.SCRAPE_MAX_LIMIT) {
    throw new Error("SCRAPE_DEFAULT_LIMIT cannot exceed SCRAPE_MAX_LIMIT");
  }
  const minimumLockTtlSeconds = minimumScrapeLockTtlSeconds(config.SCRAPE_JOB_TIMEOUT_MS);
  if (config.SCRAPE_LOCK_TTL_SECONDS < minimumLockTtlSeconds) {
    throw new Error(`SCRAPE_LOCK_TTL_SECONDS must be at least ${minimumLockTtlSeconds} seconds for the configured job timeout and retries`);
  }
  return { ...config, sites: parseConfiguredSites(config.SCRAPER_SITES_JSON) };
}

/**
 * The lock must survive every legal BullMQ attempt, the retry backoff, and a
 * small hand-off margin. It is intentionally independent of the configured
 * TTL so custom deployments are validated rather than silently unsafe.
 */
export function minimumScrapeLockTtlSeconds(jobTimeoutMs: number): number {
  return Math.ceil((jobTimeoutMs * SCRAPE_JOB_ATTEMPTS + SCRAPE_RETRY_BACKOFF_MS + SCRAPE_LOCK_SAFETY_MARGIN_MS) / 1_000);
}

export function createScrapeLockToken(acquiredAt = Date.now()): string {
  return JSON.stringify({ token: randomUUID(), acquiredAt });
}

export function scrapeLockAcquiredAt(lockToken: string): number | null {
  try {
    const value = JSON.parse(lockToken) as { acquiredAt?: unknown };
    return typeof value.acquiredAt === "number" && Number.isFinite(value.acquiredAt) ? value.acquiredAt : null;
  } catch {
    return null;
  }
}

export function isOrphanedScrapeLock(lockToken: string | null, now = Date.now(), graceMs = SCRAPE_LOCK_SAFETY_MARGIN_MS): boolean {
  const acquiredAt = lockToken ? scrapeLockAcquiredAt(lockToken) : null;
  return acquiredAt !== null && now - acquiredAt >= graceMs;
}

export function isTerminalScrapeAttempt(attemptsMade: number, maxAttempts: number, unrecoverable = false): boolean {
  return unrecoverable || attemptsMade + 1 >= maxAttempts;
}

export function buildSuccessfulScrapeResult(requestedCount: number, foundCount: number): { status: "completed"; requestedCount: number; foundCount: number } {
  if (!Number.isInteger(requestedCount) || requestedCount < 1) throw new Error("requested scrape count must be a positive integer");
  if (!Number.isInteger(foundCount) || foundCount < 0 || foundCount > requestedCount) throw new Error("found scrape count must be between zero and the requested count");
  return { status: "completed", requestedCount, foundCount };
}

// Explicit implementation identifiers make operational history comparable
// across deployments without pretending to be a build hash.
export const APIFY_PARSER_VERSIONS = Object.freeze({
  "romans-international": "romans-international:v3",
  "tom-hartley": "tom-hartley:v3",
  "redline-specialist-cars": "redline-specialist-cars:v3",
} as const);

export type ApifySiteKey = keyof typeof APIFY_PARSER_VERSIONS;

export function parseScrapeLimit(value: unknown, defaultLimit: number, maxLimit: number): number {
  if (value === undefined) return defaultLimit;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("limit must be an integer");
  if (value < 1) throw new Error("limit must be at least 1");
  if (value > maxLimit) throw new Error(`limit cannot exceed ${maxLimit}`);
  return value;
}

export function assertSingleSourcePayload(value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("request body must be an object");
  const body = value as Record<string, unknown>;
  const unsupportedKeys = Object.keys(body).filter((key) => !["siteKey", "limit"].includes(key));
  if (unsupportedKeys.length) throw new Error("only siteKey and limit are accepted");
  if ("siteKey" in body && typeof body.siteKey !== "string") throw new Error("siteKey must be a string");
}

export function findConfiguredSite(siteKey: string, sites: SiteConfig[]): SiteConfig {
  const site = sites.find((configuredSite) => configuredSite.key === siteKey);
  if (!site) throw new Error("site key is not configured");
  return site;
}

type RedisConfigSource = Pick<AppConfig, "REDIS_URL" | "REDIS_HOST" | "REDIS_PORT" | "REDIS_PASSWORD">;

/**
 * Build one Redis configuration for both ioredis and BullMQ.
 * Hosted Redis providers normally expose rediss:// URLs; local Compose uses
 * the host/port/password fallback. TLS certificate verification stays enabled.
 */
export function createRedisConnectionConfig(config: RedisConfigSource): RedisOptions {
  if (config.REDIS_URL) {
    const url = new URL(config.REDIS_URL);
    if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
      throw new Error("REDIS_URL must use redis:// or rediss://");
    }

    const connection: RedisOptions = {
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      maxRetriesPerRequest: null,
    };

    if (url.protocol === "rediss:") {
      // Northflank's public Redis endpoint requires SNI during the TLS handshake.
      // Keep certificate verification enabled while explicitly identifying the host.
      connection.tls = { rejectUnauthorized: true, servername: url.hostname };
    }

    return connection;
  }

  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}
