import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_MIGRATION_URL: z.string().url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(10_000),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .default(5_000),
});

export const databaseEnv = schema.parse(process.env);
