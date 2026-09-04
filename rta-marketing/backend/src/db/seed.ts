import { eq } from "drizzle-orm";
import { z } from "zod";

import { hashPassword } from "../auth/password.js";
import { db, pool } from "./client.js";
import { sources, users } from "./schema.js";

const seedEnvSchema = z
  .object({
    SEED_OPERATOR_EMAIL: z.string().email().optional(),
    SEED_OPERATOR_PASSWORD: z.string().min(14).optional(),
    SEED_LIVE_SOURCES: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .superRefine((value, context) => {
    const hasEmail = Boolean(value.SEED_OPERATOR_EMAIL);
    const hasPassword = Boolean(value.SEED_OPERATOR_PASSWORD);

    if (hasEmail !== hasPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "SEED_OPERATOR_EMAIL and SEED_OPERATOR_PASSWORD must be provided together",
      });
    }
  });

const seedEnv = seedEnvSchema.parse(process.env);

const sourceDefinitions = [
  { key: "autotrader", name: "AutoTrader", minDelayMs: 1800 },
  { key: "autoplanet", name: "AutoPlanet", minDelayMs: 1600 },
  {
    key: "humberview",
    name: "Humberview Volkswagen",
    minDelayMs: 1800,
  },
  {
    key: "yorkdalevw",
    name: "Yorkdale Volkswagen",
    minDelayMs: 1800,
  },
] as const;

async function seedSources(): Promise<void> {
  for (const source of sourceDefinitions) {
    await db
      .insert(sources)
      .values({
        ...source,
        liveEnabled: seedEnv.SEED_LIVE_SOURCES,
      })
      .onConflictDoUpdate({
        target: sources.key,
        set: {
          name: source.name,
          minDelayMs: source.minDelayMs,
          ...(seedEnv.SEED_LIVE_SOURCES ? { liveEnabled: true } : {}),
          updatedAt: new Date(),
        },
      });
  }
}

async function seedOperator(): Promise<void> {
  if (!seedEnv.SEED_OPERATOR_EMAIL || !seedEnv.SEED_OPERATOR_PASSWORD) {
    return;
  }

  const email = seedEnv.SEED_OPERATOR_EMAIL.trim().toLowerCase();

  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    console.log("Operator account already exists");
    return;
  }

  const passwordHash = await hashPassword(seedEnv.SEED_OPERATOR_PASSWORD);

  await db.insert(users).values({
    email,
    passwordHash,
    role: "operator",
  });

  console.log("Operator account created");
}

async function main(): Promise<void> {
  await seedSources();
  await seedOperator();

  console.log("Database seed completed");
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    console.error("Database seed failed", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void run();
