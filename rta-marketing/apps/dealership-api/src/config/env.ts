import "dotenv/config";
import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalBooleanString = booleanString.optional();

const optionalSecret = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    TRUST_PROXY: optionalBooleanString.default(false),
    PUBLIC_APP_URL: z.string().url(),
    CORS_ORIGINS: z.string().min(1),
    DATABASE_URL: z.string().url(),
    DATABASE_MIGRATION_URL: z.string().url().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(10),
    DATABASE_IDLE_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .default(10_000),
    DATABASE_CONNECT_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .default(5_000),
    REDIS_URL: z.string().url().optional().refine((value) => value === undefined || ["redis:", "rediss:"].includes(new URL(value).protocol), "REDIS_URL must use redis:// or rediss://"),
    QUEUE_PROVIDER: z.literal("sqs").default("sqs"),
    SQS_INTEGRATION_ENABLED: optionalBooleanString.default(false),
    AWS_REGION: z.string().min(1),
    AWS_PROFILE: z.string().min(1).optional(),
    SQS_SCRAPE_QUEUE_URL: z.string().url().optional(),
    SCRAPING_STACK_API_URL: z.string().url().default("http://localhost:4000"),
    // Server-to-server credential for the separate scraping API. This is
    // intentionally never exposed to the browser.
    SCRAPING_STACK_API_TOKEN: z.string().min(32).optional(),
    // Apify is the live dealership dashboard provider. Credentials remain
    // optional at boot so fixture/reference deployments can still start, but
    // trigger and status routes fail clearly when the integration is needed.
    APIFY_API_TOKEN: optionalSecret,
    APIFY_ACTOR_ID: optionalSecret,
    APIFY_API_BASE_URL: z.string().url().default("https://api.apify.com/v2"),
    APIFY_RUN_TIMEOUT_SECONDS: z.coerce.number().int().min(5).max(3_600).default(120),
    APIFY_RECONCILIATION_STALE_MS: z.coerce.number().int().min(30_000).max(86_400_000).default(300_000),
    APIFY_RECONCILIATION_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(25),
    APIFY_DEFAULT_SCRAPE_LIMIT: z.coerce.number().int().min(1).max(10).default(5),
    APIFY_MAX_SCRAPE_LIMIT: z.coerce.number().int().min(1).max(10).default(10),
    S3_DOCUMENT_BUCKET: z.string().min(3).max(63).optional(),
    DOCUMENT_UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(25_000_000)
      .default(10_000_000),
    DOCUMENT_URL_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3_600)
      .default(300),
    QUEUE_OUTBOX_POLL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(60_000)
      .default(5_000),
    QUEUE_OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(50).default(10),
    SESSION_SECRET: z.string().min(8),
    CSRF_SECRET: z.string().min(8),
    SESSION_COOKIE_NAME: z.string().min(1).default("rta_session"),
    SESSION_TTL_SECONDS: z.coerce.number().int().min(300).default(28_800),
    SESSION_COOKIE_SECURE: optionalBooleanString.default(false),
    SESSION_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    REQUEST_BODY_LIMIT: z.string().default("32kb"),
    API_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .default(60_000),
    API_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .default(900_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(10),
    SCRAPE_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .default(3_600_000),
    SCRAPE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
    DEMO_MODE: optionalBooleanString.default(true),
    DEFAULT_SCRAPE_MODE: z.enum(["fixture", "live"]).default("fixture"),
    ALLOW_LIVE_SCRAPING: optionalBooleanString.default(true),
    DEMO_RECRUITER_EMAIL: z.string().trim().email().default("recruiter.demo@rta.local"),
    DEMO_RECRUITER_PASSWORD: z.string().min(14).optional(),
    RESEND_API_KEY: optionalSecret,
    EMAIL_FROM: z.string().email().optional(),
    EMAIL_FROM_NAME: z.string().trim().min(1).max(120).default("Dealer Flow Automotive Group"),
    DEALERSHIP_WEB_URL: z.string().url().optional(),
    SCRAPING_WEB_URL: z.string().url().optional(),
    ADMIN_NOTIFICATION_EMAIL: z.string().trim().email().optional(),
    AI_ENABLED: optionalBooleanString.default(false),
    AI_PROVIDER: z.enum(["none", "gemini", "groq", "openrouter", "openai-compatible"]).default("none"),
    AI_FALLBACK_PROVIDERS: z.string().default("groq,openrouter"),
    AI_API_KEY: optionalSecret,
    GEMINI_API_KEY: optionalSecret,
    GROQ_API_KEY: optionalSecret,
    OPENROUTER_API_KEY: optionalSecret,
    GEMINI_MODEL: z.string().trim().min(1).max(100).default("gemini-2.5-flash-lite"),
    GROQ_MODEL: z.string().trim().min(1).max(100).default("openai/gpt-oss-20b"),
    OPENROUTER_MODEL: z.string().trim().min(1).max(200).default("openrouter/free"),
    OPENROUTER_HTTP_REFERER: z.string().url().optional(),
    OPENROUTER_APP_TITLE: z.string().trim().min(1).max(120).optional(),
    AI_MODEL: z.string().trim().min(1).max(200).optional(),
    AI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
    AI_PUBLIC_CHAT_ENABLED: optionalBooleanString.default(true),
    AI_MAX_INPUT_CHARS: z.coerce.number().int().min(200).max(8_000).default(2_000),
    AI_MAX_MESSAGES: z.coerce.number().int().min(1).max(12).default(8),
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(100).max(2_000).default(700),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(2_000).max(30_000).default(12_000),
    AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
    AI_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(60).default(12),
    AI_DAILY_QUOTA: z.coerce.number().int().min(1).max(2_000).default(200),
  })
  .superRefine((value, context) => {
    if (
      value.SESSION_COOKIE_SAME_SITE === "none" &&
      !value.SESSION_COOKIE_SECURE
    ) {
      context.addIssue({
        code: "custom",
        path: ["SESSION_COOKIE_SECURE"],
        message: "SESSION_COOKIE_SECURE must be true when SameSite is none",
      });
    }
    if (value.SQS_INTEGRATION_ENABLED && !value.SQS_SCRAPE_QUEUE_URL) {
      context.addIssue({
        code: "custom",
        path: ["SQS_SCRAPE_QUEUE_URL"],
        message: "SQS_SCRAPE_QUEUE_URL is required when SQS_INTEGRATION_ENABLED is true",
      });
    }
    const providerKeys = {
      gemini: value.GEMINI_API_KEY,
      groq: value.GROQ_API_KEY,
      openrouter: value.OPENROUTER_API_KEY,
      "openai-compatible": value.AI_API_KEY,
    } as const;
    if (value.AI_ENABLED && value.AI_PROVIDER !== "none" && !providerKeys[value.AI_PROVIDER]) {
      context.addIssue({
        code: "custom",
        path: [value.AI_PROVIDER === "gemini" ? "GEMINI_API_KEY" : value.AI_PROVIDER === "groq" ? "GROQ_API_KEY" : value.AI_PROVIDER === "openrouter" ? "OPENROUTER_API_KEY" : "AI_API_KEY"],
        message: `The key for the ${value.AI_PROVIDER} provider is required when AI_ENABLED is true`,
      });
    }
    if (value.APIFY_DEFAULT_SCRAPE_LIMIT > value.APIFY_MAX_SCRAPE_LIMIT) {
      context.addIssue({ code: "custom", path: ["APIFY_DEFAULT_SCRAPE_LIMIT"], message: "APIFY_DEFAULT_SCRAPE_LIMIT cannot exceed APIFY_MAX_SCRAPE_LIMIT" });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export type Environment = typeof env;
