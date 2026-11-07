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
  scrapingSites,
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

const liveScrapingSiteDefinitions = [
  { name: "Romans International", baseUrl: "https://www.romansinternational.com/used/cars/" },
  { name: "Tom Hartley", baseUrl: "https://www.tomhartley.com/used/" },
  { name: "Redline Specialist Cars", baseUrl: "https://redlinespecialistcars.co.uk/cars/" },
] as const;

async function seedLiveScrapingSites(): Promise<void> {
  for (const site of liveScrapingSiteDefinitions) {
    const existing = await db.select({ id: scrapingSites.id }).from(scrapingSites).where(eq(scrapingSites.baseUrl, site.baseUrl)).limit(1);
    if (existing[0]) {
      await db.update(scrapingSites).set({ name: site.name }).where(eq(scrapingSites.id, existing[0].id));
    } else {
      await db.insert(scrapingSites).values(site);
    }
  }
}

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
    .values({ id: ids.workspace, slug: "rta-demo", name: "Dealer Flow Automotive Group", mode: "demo" })
    .onConflictDoUpdate({
      target: workspaces.slug,
      set: { name: "Dealer Flow Automotive Group", mode: "demo", updatedAt: new Date() },
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
    ["10100000-0000-4000-8000-000000000001", ids.webSource, "Amelia", "Martin", "qualified", "2023 Volkswagen Tiguan", 12],
    ["10100000-0000-4000-8000-000000000002", ids.referralSource, "Liam", "Wilson", "contacted", "2022 Audi Q5", 10],
    ["10100000-0000-4000-8000-000000000003", ids.walkInSource, "Noah", "Thompson", "new", "2024 Volkswagen Atlas", 8],
    ["10100000-0000-4000-8000-000000000004", ids.webSource, "Olivia", "Singh", "converted", "2021 BMW X3", 6],
    ["10100000-0000-4000-8000-000000000005", ids.webSource, "Ethan", "Brown", "qualified", "2023 Honda CR-V", 4],
    ["10100000-0000-4000-8000-000000000006", ids.referralSource, "Sophia", "Garcia", "lost", "2020 Toyota RAV4", 2],
    ["10100000-0000-4000-8000-000000000007", ids.walkInSource, "Isabella", "Reed", "contacted", "2024 BMW X5", 15],
    ["10100000-0000-4000-8000-000000000008", ids.referralSource, "Mason", "Brooks", "new", "2022 Porsche Macan", 20],
    ["10100000-0000-4000-8000-000000000009", ids.webSource, "Charlotte", "Price", "converted", "2021 Audi Q7", 25],
    ["10100000-0000-4000-8000-000000000010", ids.webSource, "Benjamin", "Cox", "qualified", "2023 Mercedes-Benz GLC", 30],
    ["10100000-0000-4000-8000-000000000011", ids.referralSource, "Amara", "Bennett", "lost", "2022 Lexus RX", 35],
    ["10100000-0000-4000-8000-000000000012", ids.walkInSource, "Henry", "Ward", "new", "2024 Toyota Land Cruiser", 55],
    ["10100000-0000-4000-8000-000000000013", ids.webSource, "Mia", "Foster", "contacted", "2021 Volvo XC90", 60],
    ["10100000-0000-4000-8000-000000000014", ids.referralSource, "Elijah", "Gray", "converted", "2023 BMW 330i", 65],
    ["10100000-0000-4000-8000-000000000015", ids.walkInSource, "Avery", "James", "qualified", "2022 Range Rover Sport", 85],
    ["10100000-0000-4000-8000-000000000016", ids.webSource, "Lucas", "Hill", "new", "2020 Porsche Cayenne", 90],
    ["10100000-0000-4000-8000-000000000017", ids.referralSource, "Ella", "Green", "lost", "2024 Audi Q5", 95],
    ["10100000-0000-4000-8000-000000000018", ids.walkInSource, "James", "Adams", "contacted", "2021 Mercedes-Benz E-Class", 115],
    ["10100000-0000-4000-8000-000000000019", ids.webSource, "Luna", "Nelson", "converted", "2023 Toyota Highlander", 120],
    ["10100000-0000-4000-8000-000000000020", ids.referralSource, "Theodore", "Baker", "qualified", "2022 Genesis GV80", 125],
    ["10100000-0000-4000-8000-000000000021", ids.walkInSource, "Nora", "Rivera", "new", "2024 Honda Pilot", 145],
    ["10100000-0000-4000-8000-000000000022", ids.webSource, "Jack", "Campbell", "contacted", "2021 Acura MDX", 150],
    ["10100000-0000-4000-8000-000000000023", ids.referralSource, "Zoe", "Mitchell", "converted", "2023 Volkswagen Golf R", 155],
    ["10100000-0000-4000-8000-000000000024", ids.walkInSource, "Levi", "Roberts", "lost", "2020 BMW 540i", 160],
  ] as const;

  await db.insert(leads).values(
    demoLeads.map(([id, sourceId, firstName, lastName, status, vehicleInterest, age], index) => ({
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
      contactedAt: status === "new" ? null : daysAgo(Math.max(age - 1, 0)),
      convertedAt: status === "converted" ? daysAgo(Math.max(age - 2, 0)) : null,
      createdAt: daysAgo(age),
      updatedAt: daysAgo(Math.max(age - 2, 0)),
    })),
  ).onConflictDoNothing();

  const demoSales = [
    ["10200000-0000-4000-8000-000000000001", "DEMO-SALE-1001", "Olivia Singh", "2021 BMW X3", 4_190_000, 485_000, 7],
    ["10200000-0000-4000-8000-000000000002", "DEMO-SALE-1002", "Marcus Lee", "2023 Volkswagen Tiguan", 3_850_000, 420_000, 5],
    ["10200000-0000-4000-8000-000000000003", "DEMO-SALE-1003", "Ava Taylor", "2022 Audi Q5", 4_975_000, 510_000, 3],
    ["10200000-0000-4000-8000-000000000004", "DEMO-SALE-1004", "Lucas Moore", "2020 Toyota RAV4", 3_120_000, 365_000, 1],
    ["10200000-0000-4000-8000-000000000005", "DEMO-SALE-1005", "Charlotte Price", "2021 Audi Q7", 5_890_000, 615_000, 10],
    ["10200000-0000-4000-8000-000000000006", "DEMO-SALE-1006", "Benjamin Cox", "2023 Mercedes-Benz GLC", 6_250_000, 720_000, 15],
    ["10200000-0000-4000-8000-000000000007", "DEMO-SALE-1007", "Mason Brooks", "2022 Porsche Macan", 7_450_000, 895_000, 20],
    ["10200000-0000-4000-8000-000000000008", "DEMO-SALE-1008", "Amara Bennett", "2022 Lexus RX", 5_320_000, 545_000, 25],
    ["10200000-0000-4000-8000-000000000009", "DEMO-SALE-1009", "Isabella Reed", "2024 BMW X5", 8_150_000, 935_000, 30],
    ["10200000-0000-4000-8000-000000000010", "DEMO-SALE-1010", "Henry Ward", "2024 Toyota Land Cruiser", 9_250_000, 1_075_000, 35],
    ["10200000-0000-4000-8000-000000000011", "DEMO-SALE-1011", "Elijah Gray", "2023 BMW 330i", 4_680_000, 585_000, 55],
    ["10200000-0000-4000-8000-000000000012", "DEMO-SALE-1012", "Mia Foster", "2021 Volvo XC90", 6_730_000, 740_000, 60],
    ["10200000-0000-4000-8000-000000000013", "DEMO-SALE-1013", "Avery James", "2022 Range Rover Sport", 10_250_000, 1_180_000, 65],
    ["10200000-0000-4000-8000-000000000014", "DEMO-SALE-1014", "Lucas Hill", "2020 Porsche Cayenne", 7_180_000, 830_000, 85],
    ["10200000-0000-4000-8000-000000000015", "DEMO-SALE-1015", "Ella Green", "2024 Audi Q5", 5_150_000, 570_000, 90],
    ["10200000-0000-4000-8000-000000000016", "DEMO-SALE-1016", "James Adams", "2021 Mercedes-Benz E-Class", 5_780_000, 655_000, 95],
    ["10200000-0000-4000-8000-000000000017", "DEMO-SALE-1017", "Luna Nelson", "2023 Toyota Highlander", 4_960_000, 520_000, 115],
    ["10200000-0000-4000-8000-000000000018", "DEMO-SALE-1018", "Theodore Baker", "2022 Genesis GV80", 7_950_000, 910_000, 120],
    ["10200000-0000-4000-8000-000000000019", "DEMO-SALE-1019", "Nora Rivera", "2024 Honda Pilot", 5_380_000, 605_000, 125],
    ["10200000-0000-4000-8000-000000000020", "DEMO-SALE-1020", "Jack Campbell", "2021 Acura MDX", 5_690_000, 630_000, 145],
    ["10200000-0000-4000-8000-000000000021", "DEMO-SALE-1021", "Zoe Mitchell", "2023 Volkswagen Golf R", 4_250_000, 485_000, 150],
    ["10200000-0000-4000-8000-000000000022", "DEMO-SALE-1022", "Levi Roberts", "2020 BMW 540i", 4_890_000, 535_000, 155],
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
  await seedLiveScrapingSites();
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
