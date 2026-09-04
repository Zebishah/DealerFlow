import { eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "../auth/password.js";
import { db, pool } from "./client.js";
import { sources, users } from "./schema.js";

const seedEnv = z.object({
  SEED_OPERATOR_EMAIL: z.string().email().optional(),
  SEED_OPERATOR_PASSWORD: z.string().min(14).optional(),
  SEED_LIVE_SOURCES: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
}).parse(process.env);

const sourceDefinitions = [
  { key: "autotrader", name: "AutoTrader", minDelayMs: 1800 },
  { key: "autoplanet", name: "AutoPlanet", minDelayMs: 1600 },
  { key: "humberview", name: "Humberview Volkswagen", minDelayMs: 1800 },
  { key: "yorkdalevw", name: "Yorkdale Volkswagen", minDelayMs: 1800 },
];

async function main(): Promise<void> {
  for (const source of sourceDefinitions) {
    await db
      .insert(sources)
      .values(source)
      .onConflictDoUpdate({
        target: sources.key,
        set: {
          name: source.name,
          minDelayMs: source.minDelayMs,
          ...(seedEnv.SEED_LIVE_SOURCES ? { liveEnabled: true } : {}),
          updatedAt: new Date(),
        },
      });
    if (seedEnv.SEED_LIVE_SOURCES) {
      await db.update(sources).set({ liveEnabled: true, updatedAt: new Date() }).where(eq(sources.key, source.key));
    }
  }

  if (seedEnv.SEED_OPERATOR_EMAIL && seedEnv.SEED_OPERATOR_PASSWORD) {
    const email = seedEnv.SEED_OPERATOR_EMAIL.toLowerCase();
    const passwordHash = await hashPassword(seedEnv.SEED_OPERATOR_PASSWORD);
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length === 0) {
      await db.insert(users).values({ email, passwordHash, role: "operator" });
    }
  }
  await pool.end();
  console.log("Source configuration seeded");
}

void main().catch(async (error) => {
  console.error("Database seed failed", error);
  await pool.end();
  process.exitCode = 1;
});
