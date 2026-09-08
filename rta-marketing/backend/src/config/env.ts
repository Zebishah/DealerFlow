import "dotenv/config";
import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalBooleanString = booleanString.optional();

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
    QUEUE_PROVIDER: z.literal("sqs").default("sqs"),
    AWS_REGION: z.string().min(1),
    AWS_PROFILE: z.string().min(1).optional(),
    SQS_SCRAPE_QUEUE_URL: z.string().url(),
    SCRAPING_STACK_API_URL: z.string().url().default("http://localhost:4000"),
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
