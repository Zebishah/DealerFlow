import { z } from "zod";

const bool = z.enum(["true", "false"]).transform((value) => value === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  AWS_REGION: z.string().min(1).default("ap-south-1"),
  SQS_SCRAPE_QUEUE_URL: z.string().url().optional(),
  LIVE_SCRAPING_ENABLED: bool.default(false),
  SQS_WAIT_TIME_SECONDS: z.coerce.number().int().min(1).max(20).default(20),
  SQS_VISIBILITY_TIMEOUT_SECONDS: z.coerce.number().int().min(60).max(43_200).default(600),
  SQS_MAX_MESSAGES: z.coerce.number().int().min(1).max(10).default(1),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  SCRAPE_JOB_TIMEOUT_MS: z.coerce.number().int().min(30_000).max(840_000).default(540_000),
  BROWSER_NAVIGATION_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(180_000).default(60_000),
  BROWSER_HEADLESS: bool.default(true),
  BROWSER_EXECUTABLE_PATH: z.string().optional(),
  SCRAPE_ARTIFACT_DIR: z.string().default("/tmp/rta-scraper"),
  SCRAPE_SCREENSHOT_ON_ERROR: bool.default(false),
  SOURCE_MAX_CONCURRENT_PAGES: z.coerce.number().int().min(1).max(4).default(1),
  SOURCE_MIN_DELAY_MS: z.coerce.number().int().min(0).max(30_000).default(1500),
  SCRAPE_MAX_PAGES_PER_SOURCE: z.coerce.number().int().min(1).max(100).default(20),
  SCRAPE_MAX_LISTINGS_PER_SOURCE: z.coerce.number().int().min(1).max(2_000).default(500),
});

export const workerEnv = schema.parse(process.env);
