import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "../auth/password.js";
import { db, pool, verifyDatabaseConnection } from "./client.js";
import { databaseEnv } from "../config/database.js";
import {
  financeProviders,
  leadSources,
  leads,
  monthlyTargets,
  sales,
  sources,
  users,
  workspaces,
  type UserRole,
} from "./schema.js";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const seedEnvSchema = z
  .object({
    SEED_OPERATOR_EMAIL: z.string().trim().email().optional(),
    SEED_OPERATOR_PASSWORD: z.string().min(14).optional(),
    SEED_LIVE_SOURCES: booleanString,
    SEED_DEMO_DATA: booleanString,
    SEED_DEMO_PASSWORD: z.string().min(14).optional(),
    SEED_RECRUITER_EMAIL: z.string().trim().email().default("recruiter.demo@rta.local"),
  })
  .superRefine((value, context) => {
    if (Boolean(value.SEED_OPERATOR_EMAIL) !== Boolean(value.SEED_OPERATOR_PASSWORD)) {
      context.addIssue({
        code: "custom",
        message: "SEED_OPERATOR_EMAIL and SEED_OPERATOR_PASSWORD must be provided together",
      });
    }
    if (value.SEED_DEMO_DATA && !value.SEED_DEMO_PASSWORD) {
      context.addIssue({
        code: "custom",
        path: ["SEED_DEMO_PASSWORD"],
        message: "SEED_DEMO_PASSWORD is required when SEED_DEMO_DATA is true",
      });
    }
  });

const seedEnv = seedEnvSchema.parse(process.env);

const ids = {
  workspace: "10000000-0000-4000-8000-000000000001",
  admin: "10000000-0000-4000-8000-000000000011",
  employee: "10000000-0000-4000-8000-000000000012",
  assistant: "10000000-0000-4000-8000-000000000013",
  recruiter: "10000000-0000-4000-8000-000000000014",
  webSource: "10000000-0000-4000-8000-000000000021",
  referralSource: "10000000-0000-4000-8000-000000000022",
  walkInSource: "10000000-0000-4000-8000-000000000023",
  bank: "10000000-0000-4000-8000-000000000031",
  creditUnion: "10000000-0000-4000-8000-000000000032",
} as const;

const sourceDefinitions = [
  { key: "autotrader", name: "INFINITI of Peoria", minDelayMs: 2500 },
  { key: "autoplanet", name: "Nimnicht Chevrolet", minDelayMs: 2500 },
  { key: "humberview", name: "Baron MINI", minDelayMs: 2500 },
  { key: "yorkdalevw", name: "Mercedes-Benz of Westwood", minDelayMs: 2500 },
] as const;

async function seedScrapeSources(): Promise<void> {
  for (const source of sourceDefinitions) {
    await db
      .insert(sources)
      .values({ ...source, liveEnabled: seedEnv.SEED_LIVE_SOURCES })
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

async function ensureUser(input: {
  id?: string;
  workspaceId?: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  async function updateSeedOwnedUser(id: string): Promise<string> {
    const [updated] = await db
      .update(users)
      .set({
        workspaceId: input.workspaceId,
        email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        emailVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!updated) throw new Error(`Failed to update seeded user ${email}`);
    return updated.id;
  }

  if (existing[0]) {
    // Demo accounts have fixed IDs so their seeded relationships remain
    // stable. Refresh those accounts on reruns, while leaving an unrelated
    // existing account with the same email untouched.
    if (input.id && existing[0].id === input.id) {
      return updateSeedOwnedUser(input.id);
    }
    return existing[0].id;
  }

  if (input.id) {
    const existingById = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.id))
      .limit(1);

    if (existingById[0]) return updateSeedOwnedUser(input.id);
  }

  const [created] = await db
    .insert(users)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      email,
      passwordHash: await hashPassword(input.password),
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      emailVerifiedAt: new Date(),
    })
    .returning({ id: users.id });

  if (!created) throw new Error(`Failed to seed user ${email}`);
  return created.id;
}

async function seedOperator(): Promise<void> {
  if (!seedEnv.SEED_OPERATOR_EMAIL || !seedEnv.SEED_OPERATOR_PASSWORD) return;
  await ensureUser({
    email: seedEnv.SEED_OPERATOR_EMAIL,
    password: seedEnv.SEED_OPERATOR_PASSWORD,
    role: "operator",
  });
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function seedDemoWorkspace(): Promise<void> {
  if (!seedEnv.SEED_DEMO_DATA || !seedEnv.SEED_DEMO_PASSWORD) return;

  await db
    .insert(workspaces)
    .values({ id: ids.workspace, slug: "rta-demo", name: "RTA Automotive Group", mode: "demo" })
    .onConflictDoUpdate({
      target: workspaces.slug,
      set: { name: "RTA Automotive Group", mode: "demo", updatedAt: new Date() },
    });

  await Promise.all([
    ensureUser({ id: ids.admin, workspaceId: ids.workspace, email: "admin@rta.demo", password: seedEnv.SEED_DEMO_PASSWORD, firstName: "Maya", lastName: "Chen", role: "admin" }),
    ensureUser({ id: ids.employee, workspaceId: ids.workspace, email: "sales@rta.demo", password: seedEnv.SEED_DEMO_PASSWORD, firstName: "Daniel", lastName: "Brooks", role: "employee" }),
    ensureUser({ id: ids.assistant, workspaceId: ids.workspace, email: "assistant@rta.demo", password: seedEnv.SEED_DEMO_PASSWORD, firstName: "Priya", lastName: "Shah", role: "virtual_assistant" }),
    ensureUser({ id: ids.recruiter, workspaceId: ids.workspace, email: seedEnv.SEED_RECRUITER_EMAIL, password: seedEnv.SEED_DEMO_PASSWORD, firstName: "Portfolio", lastName: "Reviewer", role: "recruiter" }),
  ]);

  await db.insert(leadSources).values([
    { id: ids.webSource, workspaceId: ids.workspace, name: "Website" },
    { id: ids.referralSource, workspaceId: ids.workspace, name: "Customer referral" },
    { id: ids.walkInSource, workspaceId: ids.workspace, name: "Showroom walk-in" },
  ]).onConflictDoNothing();

  await db.insert(financeProviders).values([
    { id: ids.bank, workspaceId: ids.workspace, name: "Northern Bank" },
    { id: ids.creditUnion, workspaceId: ids.workspace, name: "Ontario Credit Union" },
  ]).onConflictDoNothing();

  const demoLeads = [
    ["10100000-0000-4000-8000-000000000001", ids.webSource, "Amelia", "Martin", "qualified", "2023 Volkswagen Tiguan"],
    ["10100000-0000-4000-8000-000000000002", ids.referralSource, "Liam", "Wilson", "contacted", "2022 Audi Q5"],
    ["10100000-0000-4000-8000-000000000003", ids.walkInSource, "Noah", "Thompson", "new", "2024 Volkswagen Atlas"],
    ["10100000-0000-4000-8000-000000000004", ids.webSource, "Olivia", "Singh", "converted", "2021 BMW X3"],
    ["10100000-0000-4000-8000-000000000005", ids.webSource, "Ethan", "Brown", "qualified", "2023 Honda CR-V"],
    ["10100000-0000-4000-8000-000000000006", ids.referralSource, "Sophia", "Garcia", "lost", "2020 Toyota RAV4"],
  ] as const;

  await db.insert(leads).values(
    demoLeads.map(([id, sourceId, firstName, lastName, status, vehicleInterest], index) => ({
      id,
      workspaceId: ids.workspace,
      sourceId,
      assignedToUserId: ids.employee,
      createdByUserId: ids.assistant,
      externalReference: `DEMO-LEAD-${index + 1}`,
      firstName,
      lastName,
      email: `${firstName}.${lastName}@example.com`.toLowerCase(),
      phone: `+1 416 555 01${String(index + 1).padStart(2, "0")}`,
      vehicleInterest,
      status,
      createdAt: daysAgo(12 - index * 2),
      updatedAt: daysAgo(Math.max(0, 5 - index)),
    })),
  ).onConflictDoNothing();

  const demoSales = [
    ["10200000-0000-4000-8000-000000000001", "DEMO-SALE-1001", "Olivia Singh", "2021 BMW X3", 4_190_000, 485_000, 7],
    ["10200000-0000-4000-8000-000000000002", "DEMO-SALE-1002", "Marcus Lee", "2023 Volkswagen Tiguan", 3_850_000, 420_000, 5],
    ["10200000-0000-4000-8000-000000000003", "DEMO-SALE-1003", "Ava Taylor", "2022 Audi Q5", 4_975_000, 510_000, 3],
    ["10200000-0000-4000-8000-000000000004", "DEMO-SALE-1004", "Lucas Moore", "2020 Toyota RAV4", 3_120_000, 365_000, 1],
  ] as const;

  await db.insert(sales).values(
    demoSales.map(([id, externalSaleId, customerName, vehicleDescription, salePriceCents, grossProfitCents, age]) => ({
      id,
      workspaceId: ids.workspace,
      salespersonId: ids.employee,
      createdByUserId: ids.admin,
      financeProviderId: age % 2 === 0 ? ids.creditUnion : ids.bank,
      externalSaleId,
      type: age === 1 ? "wholesale" as const : "retail" as const,
      status: "funded" as const,
      customerName,
      vehicleDescription,
      salePriceCents,
      grossProfitCents,
      commissionRateBasisPoints: 2500,
      commissionAmountCents: Math.round(grossProfitCents * 0.25),
      soldAt: daysAgo(age),
    })),
  ).onConflictDoNothing();

  const month = new Date().toISOString().slice(0, 7);
  await db.insert(monthlyTargets).values({
    id: "10300000-0000-4000-8000-000000000001",
    workspaceId: ids.workspace,
    userId: ids.employee,
    month,
    retailTarget: 12,
    wholesaleTarget: 3,
    grossProfitTargetCents: 5_500_000,
  }).onConflictDoUpdate({
    target: monthlyTargets.id,
    set: { month, retailTarget: 12, wholesaleTarget: 3, grossProfitTargetCents: 5_500_000, updatedAt: new Date() },
  });
}

async function verifySeedDatabaseConnection(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await verifyDatabaseConnection();
      return;
    } catch (error: unknown) {
      lastError = error;
      if (!isConnectivityError(error) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    }
  }

  throw lastError;
}

async function main(): Promise<void> {
  // Fail before the first write with a useful message when the database
  // endpoint cannot be reached. The first Drizzle query otherwise wraps the
  // connection error and makes a network problem look like a seed SQL error.
  await verifySeedDatabaseConnection();
  await seedScrapeSources();
  await seedOperator();
  await seedDemoWorkspace();
  console.log("Database seed completed");
}

function databaseHost(): string {
  try {
    return new URL(databaseEnv.DATABASE_URL).hostname;
  } catch {
    return "the configured PostgreSQL endpoint";
  }
}

function isConnectivityError(error: unknown): boolean {
  const connectivityCodes = [
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ECONNREFUSED",
  ];
  const seen = new Set<object>();

  function visit(candidate: unknown): boolean {
    if (!candidate || typeof candidate !== "object") return false;
    if (seen.has(candidate)) return false;
    seen.add(candidate);

    const value = candidate as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
      errors?: unknown;
    };
    const text = [value.code, value.message, String(candidate)]
      .filter((part): part is string => typeof part === "string")
      .join(" ");

    return (
      connectivityCodes.some((code) => text.includes(code)) ||
      visit(value.cause) ||
      (Array.isArray(value.errors) && value.errors.some(visit))
    );
  }

  return visit(error);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (error: unknown) {
    if (isConnectivityError(error)) {
      console.error(
        `Database seed failed: PostgreSQL at ${databaseHost()} could not be reached.`,
      );
      console.error(
        "For normal API traffic, use Neon’s pooled URL (the hostname contains -pooler). For this one-time seed, any reachable Neon URL is valid; if the pooled endpoint times out, retry with the direct URL. Also confirm the Neon project is active and outbound TCP/5432 is allowed.",
      );
    } else {
      console.error("Database seed failed", error);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void run();
