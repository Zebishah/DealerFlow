import "dotenv/config";
import { z } from "zod";
import pino from "pino";

export const logger = pino({
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const siteEngineSchema = z.enum(["cheerio", "playwright"]);

export const siteConfigSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  engine: siteEngineSchema,
  itemSelector: z.string().min(1).default("[data-vehicle-card]"),
  titleSelector: z.string().min(1).default("[data-vehicle-title], h2, h3"),
  priceSelector: z.string().min(1).default("[data-vehicle-price], .price"),
  linkSelector: z.string().min(1).default("a"),
  delayMs: z.coerce.number().int().min(0).max(60000).default(2500),
  maxConcurrency: z.coerce.number().int().min(1).max(2).default(2),
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
  REDIS_HOST: z.string().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  SCRAPE_CRON: z.string().min(1).default("0 */6 * * *"),
  SCRAPER_USER_AGENT: z.string().min(10).default("RTA-Portfolio-Scraper/1.0 (+https://example.com/contact)"),
  CHROMIUM_EXECUTABLE_PATH: z.string().optional(),
  SCRAPER_SITES_JSON: z.string().default("[]"),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type ScrapedItem = z.infer<typeof scrapedItemSchema>;

export function loadConfig() {
  const config = appConfigSchema.parse(process.env);
  const sites = z.array(siteConfigSchema).parse(JSON.parse(config.SCRAPER_SITES_JSON));
  return { ...config, sites };
}
