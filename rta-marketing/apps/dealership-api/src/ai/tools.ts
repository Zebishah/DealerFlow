import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/session.js";
import { db } from "../db/client.js";
import {
  leads,
  listings,
  monthlyTargets,
  sales,
  scrapeRuns,
  sourceRuns,
  sources,
  users,
  vehicles,
} from "../db/schema.js";
import { AppError } from "../lib/errors.js";
import type { AssistantContext } from "./contracts.js";
import { searchKnowledge } from "./knowledge/index.js";
import type { AiToolDefinition } from "./provider.js";

export interface AssistantToolContext {
  user?: AuthenticatedUser;
  context?: AssistantContext;
}

type ParseableSchema = { parse(value: unknown): unknown };

export interface AssistantTool {
  definition: AiToolDefinition;
  schema: ParseableSchema;
  public: boolean;
  execute(args: unknown, context: AssistantToolContext): Promise<unknown>;
}

function authenticated(context: AssistantToolContext): AuthenticatedUser {
  if (!context.user) throw new AppError(401, "AUTH_REQUIRED", "Sign in to use operational data");
  return context.user;
}

function workspaceFor(user: AuthenticatedUser): string {
  if (!user.workspaceId) throw new AppError(403, "WORKSPACE_REQUIRED", "A workspace is required for this data");
  return user.workspaceId;
}

function leadVisibility(user: AuthenticatedUser, workspaceId: string): SQL {
  return user.role === "employee"
    ? and(eq(leads.workspaceId, workspaceId), eq(leads.assignedToUserId, user.id))!
    : eq(leads.workspaceId, workspaceId);
}

function salesVisibility(user: AuthenticatedUser, workspaceId: string): SQL {
  if (user.role === "virtual_assistant" || user.role === "viewer") return sql`false`;
  return user.role === "employee"
    ? and(eq(sales.workspaceId, workspaceId), eq(sales.salespersonId, user.id))!
    : eq(sales.workspaceId, workspaceId);
}

function money(value: unknown): number {
  return Number(value ?? 0);
}

function periodStart(period: "month" | "90_days" | "year"): Date {
  const now = new Date();
  return period === "year"
    ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
    : period === "90_days"
      ? new Date(now.getTime() - 90 * 86_400_000)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const noArgs = z.object({});
const helpArgs = z.object({ topic: z.string().trim().max(100).default("") });
const leadSearchArgs = z.object({
  query: z.string().trim().max(100).default(""),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  limit: z.number().int().min(1).max(8).default(5),
});
const leadSummaryArgs = z.object({ leadId: z.string().uuid() });
const inventoryArgs = z.object({
  query: z.string().trim().max(100).default(""),
  make: z.string().trim().max(80).optional(),
  model: z.string().trim().max(100).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  minYear: z.number().int().min(1980).optional(),
  maxYear: z.number().int().max(new Date().getUTCFullYear() + 1).optional(),
  limit: z.number().int().min(1).max(8).default(5),
});
const vehicleArgs = z.object({ vehicleId: z.string().uuid() });
const salesArgs = z.object({ period: z.enum(["month", "90_days", "year"]).default("month") });
const runArgs = z.object({ runId: z.string().uuid().optional() });
const analyticsArgs = z.object({ period: z.enum(["month", "90_days", "year"]).default("month") });
const leadIntelligenceArgs = z.object({ leadId: z.string().uuid() });
const recommendationArgs = z.object({ query: z.string().trim().max(100).default(""), bodyStyle: z.string().trim().max(60).optional(), minPrice: z.number().int().min(0).optional(), maxPrice: z.number().int().min(0).optional(), minYear: z.number().int().min(1980).optional(), maxYear: z.number().int().max(new Date().getUTCFullYear() + 1).optional(), limit: z.number().int().min(1).max(8).default(5) });
const compareArgs = z.object({ vehicleIds: z.array(z.string().uuid()).min(1).max(4) });
const marketPriceArgs = z.object({ vehicleId: z.string().uuid() });
const performanceArgs = z.object({ period: z.enum(["month", "90_days", "year"]).default("month") });
const troubleshootingArgs = z.object({ runId: z.string().uuid().optional() });

function tool(
  name: string,
  description: string,
  schema: ParseableSchema,
  parameters: Record<string, unknown>,
  execute: AssistantTool["execute"],
  isPublic = false,
): AssistantTool {
  return {
    definition: { type: "function", function: { name, description, parameters } },
    schema,
    public: isPublic,
    execute,
  };
}

export const assistantTools: readonly AssistantTool[] = [
  tool(
    "getPlatformHelp",
    "Search verified Dealer Flow product, architecture, security, deployment, and workflow guidance. Public-safe.",
    helpArgs,
    { type: "object", properties: { topic: { type: "string", maxLength: 100 } } },
    async (rawArgs) => {
      const args = helpArgs.parse(rawArgs);
      return { entries: searchKnowledge(args.topic || "Dealer Flow platform", 3).map(({ title, topic, content }) => ({ title, topic, content })) };
    },
    true,
  ),
  tool(
    "getDashboardSummary",
    "Return workspace-scoped monthly lead, sales, target, and recent activity facts. Never invent metrics.",
    noArgs,
    { type: "object", properties: {} },
    async (_rawArgs, context) => {
      const user = authenticated(context);
      const workspaceId = workspaceFor(user);
      const now = new Date();
      const month = now.toISOString().slice(0, 7);
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const leadScope = leadVisibility(user, workspaceId);
      const saleScope = salesVisibility(user, workspaceId);
      const [leadMetrics, saleMetrics, targetRows] = await Promise.all([
        db.select({
          total: sql<number>`count(*)::int`,
          new: sql<number>`count(*) filter (where ${leads.status} = 'new')::int`,
          qualified: sql<number>`count(*) filter (where ${leads.status} = 'qualified')::int`,
          converted: sql<number>`count(*) filter (where ${leads.status} = 'converted')::int`,
        }).from(leads).where(and(leadScope, gte(leads.createdAt, monthStart))),
        db.select({
          total: sql<number>`count(*)::int`,
          funded: sql<number>`count(*) filter (where ${sales.status} = 'funded')::int`,
          revenueCents: sql<number>`coalesce(sum(${sales.salePriceCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`,
          grossProfitCents: sql<number>`coalesce(sum(${sales.grossProfitCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`,
        }).from(sales).where(and(saleScope, gte(sales.soldAt, monthStart))),
        user.role === "virtual_assistant" || user.role === "viewer"
          ? Promise.resolve([])
          : db.select({ retailTarget: monthlyTargets.retailTarget, wholesaleTarget: monthlyTargets.wholesaleTarget, grossProfitTargetCents: monthlyTargets.grossProfitTargetCents })
            .from(monthlyTargets)
            .where(and(eq(monthlyTargets.workspaceId, workspaceId), eq(monthlyTargets.month, month), user.role === "employee" ? eq(monthlyTargets.userId, user.id) : sql`true`))
            .limit(1),
      ]);
      return {
        period: month,
        leads: leadMetrics[0] ?? { total: 0, new: 0, qualified: 0, converted: 0 },
        sales: (() => { const value = saleMetrics[0] ?? { total: 0, funded: 0, revenueCents: 0, grossProfitCents: 0 }; return { ...value, revenueCents: money(value.revenueCents), grossProfitCents: money(value.grossProfitCents) }; })(),
        target: targetRows[0] ?? null,
      };
    },
  ),
  tool(
    "searchLeads",
    "Search leads visible to the current user. Employees see only their assigned leads.",
    leadSearchArgs,
    { type: "object", properties: { query: { type: "string" }, status: { type: "string", enum: ["new", "contacted", "qualified", "converted", "lost"] }, limit: { type: "integer", minimum: 1, maximum: 8 } } },
    async (rawArgs, context) => {
      const args = leadSearchArgs.parse(rawArgs);
      const user = authenticated(context);
      if (!["admin", "employee", "virtual_assistant", "recruiter"].includes(user.role)) throw new AppError(403, "LEAD_ACCESS_FORBIDDEN", "Your role cannot access lead records");
      const conditions: SQL[] = [leadVisibility(user, workspaceFor(user))];
      if (args.status) conditions.push(eq(leads.status, args.status));
      if (args.query) {
        const search = `%${args.query}%`;
        conditions.push(or(ilike(leads.firstName, search), ilike(leads.lastName, search), ilike(leads.vehicleInterest, search), ilike(leads.notes, search))!);
      }
      const rows = await db.select({ id: leads.id, firstName: leads.firstName, lastName: leads.lastName, status: leads.status, vehicleInterest: leads.vehicleInterest, createdAt: leads.createdAt, updatedAt: leads.updatedAt })
        .from(leads).where(and(...conditions)).orderBy(desc(leads.updatedAt)).limit(args.limit);
      return { count: rows.length, leads: rows };
    },
  ),
  tool(
    "getLeadSummary",
    "Return a concise authorized summary for one lead without exposing unnecessary contact details.",
    leadSummaryArgs,
    { type: "object", required: ["leadId"], properties: { leadId: { type: "string", format: "uuid" } } },
    async (rawArgs, context) => {
      const args = leadSummaryArgs.parse(rawArgs);
      const user = authenticated(context);
      if (!["admin", "employee", "virtual_assistant", "recruiter"].includes(user.role)) throw new AppError(403, "LEAD_ACCESS_FORBIDDEN", "Your role cannot access lead records");
      const [row] = await db.select({ id: leads.id, firstName: leads.firstName, lastName: leads.lastName, status: leads.status, vehicleInterest: leads.vehicleInterest, contactedAt: leads.contactedAt, convertedAt: leads.convertedAt, createdAt: leads.createdAt, updatedAt: leads.updatedAt })
        .from(leads).where(and(eq(leads.id, args.leadId), leadVisibility(user, workspaceFor(user)))).limit(1);
      if (!row) throw new AppError(404, "LEAD_NOT_FOUND", "That lead is not available to you");
      return row;
    },
  ),
  tool(
    "searchInventory",
    "Search active canonical vehicle listings using validated filters. Every result comes from persisted inventory.",
    inventoryArgs,
    { type: "object", properties: { query: { type: "string" }, make: { type: "string" }, model: { type: "string" }, minPrice: { type: "integer", minimum: 0 }, maxPrice: { type: "integer", minimum: 0 }, minYear: { type: "integer" }, maxYear: { type: "integer" }, limit: { type: "integer", minimum: 1, maximum: 8 } } },
    async (rawArgs, context) => {
      authenticated(context);
      const args = inventoryArgs.parse(rawArgs);
      const conditions: SQL[] = [eq(listings.status, "active")];
      if (args.query) { const search = `%${args.query}%`; conditions.push(or(ilike(listings.title, search), ilike(vehicles.make, search), ilike(vehicles.model, search))!); }
      if (args.make) conditions.push(ilike(vehicles.make, args.make));
      if (args.model) conditions.push(ilike(vehicles.model, args.model));
      if (args.minPrice !== undefined) conditions.push(gte(listings.priceCents, args.minPrice * 100));
      if (args.maxPrice !== undefined) conditions.push(lte(listings.priceCents, args.maxPrice * 100));
      if (args.minYear !== undefined) conditions.push(gte(vehicles.year, args.minYear));
      if (args.maxYear !== undefined) conditions.push(lte(vehicles.year, args.maxYear));
      const rows = await db.select({ vehicleId: vehicles.id, listingId: listings.id, title: listings.title, make: vehicles.make, model: vehicles.model, year: vehicles.year, priceCents: listings.priceCents, odometerKm: listings.odometerKm, location: listings.location, source: sources.name, url: listings.url })
        .from(listings).innerJoin(vehicles, eq(listings.vehicleId, vehicles.id)).innerJoin(sources, eq(listings.sourceId, sources.id)).where(and(...conditions)).orderBy(desc(listings.lastSeenAt)).limit(args.limit);
      return { count: rows.length, vehicles: rows.map((row) => ({ ...row, priceCents: row.priceCents === null ? null : Number(row.priceCents) })) };
    },
  ),
  tool(
    "getVehicleDetails",
    "Return one vehicle and its active source offers from persisted inventory.",
    vehicleArgs,
    { type: "object", required: ["vehicleId"], properties: { vehicleId: { type: "string", format: "uuid" } } },
    async (rawArgs, context) => {
      authenticated(context);
      const args = vehicleArgs.parse(rawArgs);
      const [vehicle] = await db.select({ id: vehicles.id, make: vehicles.make, model: vehicles.model, trim: vehicles.trim, year: vehicles.year, bodyStyle: vehicles.bodyStyle, transmission: vehicles.transmission, drivetrain: vehicles.drivetrain, engine: vehicles.engine, exteriorColor: vehicles.exteriorColor, isUsed: vehicles.isUsed }).from(vehicles).where(eq(vehicles.id, args.vehicleId)).limit(1);
      if (!vehicle) throw new AppError(404, "VEHICLE_NOT_FOUND", "That vehicle is not available");
      const offers = await db.select({ source: sources.name, title: listings.title, priceCents: listings.priceCents, odometerKm: listings.odometerKm, location: listings.location, url: listings.url, lastSeenAt: listings.lastSeenAt })
        .from(listings).innerJoin(sources, eq(listings.sourceId, sources.id)).where(and(eq(listings.vehicleId, args.vehicleId), eq(listings.status, "active"))).orderBy(listings.priceCents);
      return { vehicle, offers: offers.map((offer) => ({ ...offer, priceCents: offer.priceCents === null ? null : Number(offer.priceCents) })) };
    },
  ),
  tool(
    "getSalesSummary",
    "Return deterministic sales totals for the current workspace and role scope.",
    salesArgs,
    { type: "object", properties: { period: { type: "string", enum: ["month", "90_days", "year"] } } },
    async (rawArgs, context) => {
      const args = salesArgs.parse(rawArgs);
      const user = authenticated(context);
      if (!["admin", "operator", "employee", "recruiter"].includes(user.role)) throw new AppError(403, "SALES_ACCESS_FORBIDDEN", "Your role cannot access sales totals");
      const now = new Date();
      const start = args.period === "year" ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) : args.period === "90_days" ? new Date(now.getTime() - 90 * 86_400_000) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const [summary] = await db.select({ total: count(), funded: sql<number>`count(*) filter (where ${sales.status} = 'funded')::int`, revenueCents: sql<number>`coalesce(sum(${sales.salePriceCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`, grossProfitCents: sql<number>`coalesce(sum(${sales.grossProfitCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`, commissionCents: sql<number>`coalesce(sum(${sales.commissionAmountCents}) filter (where ${sales.status} = 'funded'), 0)::bigint` }).from(sales).where(and(salesVisibility(user, workspaceFor(user)), gte(sales.soldAt, start)));
      return { period: args.period, total: Number(summary?.total ?? 0), funded: Number(summary?.funded ?? 0), revenueCents: money(summary?.revenueCents), grossProfitCents: money(summary?.grossProfitCents), commissionCents: money(summary?.commissionCents) };
    },
  ),
  tool(
    "getAnalyticsSummary",
    "Calculate workspace-scoped lead funnel, sales, conversion, and active inventory metrics for a selected period.",
    analyticsArgs,
    { type: "object", properties: { period: { type: "string", enum: ["month", "90_days", "year"] } } },
    async (rawArgs, context) => {
      const args = analyticsArgs.parse(rawArgs);
      const user = authenticated(context);
      if (!["admin", "employee", "recruiter"].includes(user.role)) throw new AppError(403, "ANALYTICS_ACCESS_FORBIDDEN", "Your role cannot access analytics");
      const workspaceId = workspaceFor(user);
      const start = periodStart(args.period);
      const leadScope = leadVisibility(user, workspaceId);
      const saleScope = salesVisibility(user, workspaceId);
      const [leadRows, saleRows, inventoryRows] = await Promise.all([
        db.select({
          total: count(),
          new: sql<number>`count(*) filter (where ${leads.status} = 'new')::int`,
          contacted: sql<number>`count(*) filter (where ${leads.status} = 'contacted')::int`,
          qualified: sql<number>`count(*) filter (where ${leads.status} = 'qualified')::int`,
          converted: sql<number>`count(*) filter (where ${leads.status} = 'converted')::int`,
          lost: sql<number>`count(*) filter (where ${leads.status} = 'lost')::int`,
        }).from(leads).where(and(leadScope, gte(leads.createdAt, start))),
        db.select({
          total: count(),
          funded: sql<number>`count(*) filter (where ${sales.status} = 'funded')::int`,
          revenueCents: sql<number>`coalesce(sum(${sales.salePriceCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`,
          grossProfitCents: sql<number>`coalesce(sum(${sales.grossProfitCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`,
        }).from(sales).where(and(saleScope, gte(sales.soldAt, start))),
        db.select({ total: count() }).from(listings).where(eq(listings.status, "active")),
      ]);
      const lead = leadRows[0];
      const sale = saleRows[0];
      const totalLeads = Number(lead?.total ?? 0);
      const converted = Number(lead?.converted ?? 0);
      return {
        period: args.period,
        leads: { total: totalLeads, new: Number(lead?.new ?? 0), contacted: Number(lead?.contacted ?? 0), qualified: Number(lead?.qualified ?? 0), converted, lost: Number(lead?.lost ?? 0) },
        conversionRate: totalLeads ? Math.round((converted / totalLeads) * 1000) / 10 : 0,
        sales: { total: Number(sale?.total ?? 0), funded: Number(sale?.funded ?? 0), revenueCents: money(sale?.revenueCents), grossProfitCents: money(sale?.grossProfitCents) },
        activeInventory: Number(inventoryRows[0]?.total ?? 0),
      };
    },
  ),
  tool(
    "getLeadNextAction",
    "Return a deterministic next-action recommendation for one authorized lead using status and timestamps only.",
    leadIntelligenceArgs,
    { type: "object", required: ["leadId"], properties: { leadId: { type: "string", format: "uuid" } } },
    async (rawArgs, context) => {
      const args = leadIntelligenceArgs.parse(rawArgs);
      const user = authenticated(context);
      if (!["admin", "employee", "virtual_assistant", "recruiter"].includes(user.role)) throw new AppError(403, "LEAD_ACCESS_FORBIDDEN", "Your role cannot access lead records");
      const [lead] = await db.select({ id: leads.id, firstName: leads.firstName, lastName: leads.lastName, status: leads.status, vehicleInterest: leads.vehicleInterest, contactedAt: leads.contactedAt, convertedAt: leads.convertedAt, createdAt: leads.createdAt, updatedAt: leads.updatedAt })
        .from(leads).where(and(eq(leads.id, args.leadId), leadVisibility(user, workspaceFor(user)))).limit(1);
      if (!lead) throw new AppError(404, "LEAD_NOT_FOUND", "That lead is not available to you");
      const ageDays = Math.max(0, Math.floor((Date.now() - lead.updatedAt.getTime()) / 86_400_000));
      const nextAction = lead.status === "new" ? "Make the first contact and record the outcome" : lead.status === "contacted" ? "Follow up and confirm qualification" : lead.status === "qualified" ? "Advance the qualified opportunity toward a sale" : lead.status === "converted" ? "No follow-up is required unless the customer needs support" : "Review whether the lost lead should be closed or re-engaged";
      const priority = lead.status === "new" && ageDays >= 2 ? "high" : lead.status === "qualified" ? "high" : lead.status === "lost" || lead.status === "converted" ? "low" : "normal";
      return { leadId: lead.id, leadName: `${lead.firstName} ${lead.lastName}`, status: lead.status, vehicleInterest: lead.vehicleInterest, priority, nextAction, reason: ageDays ? `The lead has had no recorded update for ${ageDays} day${ageDays === 1 ? "" : "s"}.` : "The lead was updated recently; use the current status to guide the next step." };
    },
  ),
  tool(
    "recommendVehicles",
    "Recommend active persisted vehicle listings from explicit search criteria. Do not use external web data.",
    recommendationArgs,
    { type: "object", properties: { query: { type: "string" }, bodyStyle: { type: "string" }, minPrice: { type: "integer" }, maxPrice: { type: "integer" }, minYear: { type: "integer" }, maxYear: { type: "integer" }, limit: { type: "integer", minimum: 1, maximum: 8 } } },
    async (rawArgs, context) => {
      authenticated(context);
      const args = recommendationArgs.parse(rawArgs);
      const conditions: SQL[] = [eq(listings.status, "active")];
      if (args.query) { const search = `%${args.query}%`; conditions.push(or(ilike(listings.title, search), ilike(vehicles.make, search), ilike(vehicles.model, search), ilike(vehicles.bodyStyle, search))!); }
      if (args.bodyStyle) conditions.push(ilike(vehicles.bodyStyle, args.bodyStyle));
      if (args.minPrice !== undefined) conditions.push(gte(listings.priceCents, args.minPrice * 100));
      if (args.maxPrice !== undefined) conditions.push(lte(listings.priceCents, args.maxPrice * 100));
      if (args.minYear !== undefined) conditions.push(gte(vehicles.year, args.minYear));
      if (args.maxYear !== undefined) conditions.push(lte(vehicles.year, args.maxYear));
      const rows = await db.select({ vehicleId: vehicles.id, title: listings.title, make: vehicles.make, model: vehicles.model, year: vehicles.year, bodyStyle: vehicles.bodyStyle, priceCents: listings.priceCents, odometerKm: listings.odometerKm, location: listings.location, source: sources.name, url: listings.url })
        .from(listings).innerJoin(vehicles, eq(listings.vehicleId, vehicles.id)).innerJoin(sources, eq(listings.sourceId, sources.id)).where(and(...conditions)).orderBy(desc(listings.lastSeenAt)).limit(args.limit);
      const terms = args.query.toLowerCase().split(/\s+/).filter(Boolean);
      return { count: rows.length, recommendations: rows.map((row) => { const haystack = `${row.title} ${row.make} ${row.model} ${row.bodyStyle ?? ""}`.toLowerCase(); const matched = terms.filter((term) => haystack.includes(term)).length; return { ...row, priceCents: row.priceCents === null ? null : Number(row.priceCents), matchScore: terms.length ? Math.round((matched / terms.length) * 100) : 100, matchReason: terms.length ? `${matched} of ${terms.length} requested terms matched persisted inventory fields` : "Matches the supplied inventory criteria" }; }) };
    },
  ),
  tool(
    "compareVehicleListings",
    "Compare up to four selected vehicles using active persisted source offers only.",
    compareArgs,
    { type: "object", required: ["vehicleIds"], properties: { vehicleIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", format: "uuid" } } } },
    async (rawArgs, context) => {
      authenticated(context);
      const args = compareArgs.parse(rawArgs);
      const rows = await db.select({ vehicleId: vehicles.id, make: vehicles.make, model: vehicles.model, year: vehicles.year, bodyStyle: vehicles.bodyStyle, source: sources.name, priceCents: listings.priceCents, odometerKm: listings.odometerKm, location: listings.location })
        .from(listings).innerJoin(vehicles, eq(listings.vehicleId, vehicles.id)).innerJoin(sources, eq(listings.sourceId, sources.id)).where(and(inArray(listings.vehicleId, args.vehicleIds), eq(listings.status, "active"))).orderBy(listings.priceCents);
      const grouped = args.vehicleIds.map((vehicleId) => {
        const offers = rows.filter((row) => row.vehicleId === vehicleId);
        const prices = offers.map((offer) => offer.priceCents === null ? null : Number(offer.priceCents)).filter((price): price is number => price !== null).sort((a, b) => a - b);
        const first = offers[0];
        return { vehicleId, make: first?.make ?? "Unknown", model: first?.model ?? "vehicle", year: first?.year ?? null, bodyStyle: first?.bodyStyle ?? null, offerCount: offers.length, minPriceCents: prices[0] ?? null, maxPriceCents: prices.at(-1) ?? null, priceRange: prices.length ? `${prices[0]}-${prices.at(-1)}` : "Price unavailable", sources: [...new Set(offers.map((offer) => offer.source))].join(", ") || null };
      });
      return { vehicles: grouped };
    },
  ),
  tool(
    "getMarketPriceExplanation",
    "Explain a vehicle's position against comparable active inventory listings with the same make, model, and year.",
    marketPriceArgs,
    { type: "object", required: ["vehicleId"], properties: { vehicleId: { type: "string", format: "uuid" } } },
    async (rawArgs, context) => {
      authenticated(context);
      const args = marketPriceArgs.parse(rawArgs);
      const [reference] = await db.select({ id: vehicles.id, make: vehicles.make, model: vehicles.model, year: vehicles.year }).from(vehicles).where(eq(vehicles.id, args.vehicleId)).limit(1);
      if (!reference) throw new AppError(404, "VEHICLE_NOT_FOUND", "That vehicle is not available");
      const comparable = await db.select({ priceCents: listings.priceCents }).from(listings).innerJoin(vehicles, eq(listings.vehicleId, vehicles.id)).where(and(eq(listings.status, "active"), eq(vehicles.make, reference.make), eq(vehicles.model, reference.model), eq(vehicles.year, reference.year)));
      const prices = comparable.map((row) => row.priceCents === null ? null : Number(row.priceCents)).filter((price): price is number => price !== null).sort((a, b) => a - b);
      const medianPriceCents = prices.length ? prices[Math.floor((prices.length - 1) / 2)]! : null;
      const minPriceCents = prices[0] ?? null;
      const maxPriceCents = prices.at(-1) ?? null;
      const position = prices.length < 2 ? "Insufficient comparable inventory" : minPriceCents === medianPriceCents ? "At the lower end of comparable inventory" : maxPriceCents === medianPriceCents ? "At the upper end of comparable inventory" : "Within the comparable inventory range";
      return { vehicleId: reference.id, vehicleName: `${reference.year} ${reference.make} ${reference.model}`, comparableCount: prices.length, minPriceCents, medianPriceCents, maxPriceCents, position, basis: "Active persisted listings with the same make, model, and year; this is not an external appraisal." };
    },
  ),
  tool(
    "getPerformanceInsights",
    "Calculate workspace-scoped sales performance totals and salesperson breakdowns without exposing customer data.",
    performanceArgs,
    { type: "object", properties: { period: { type: "string", enum: ["month", "90_days", "year"] } } },
    async (rawArgs, context) => {
      const args = performanceArgs.parse(rawArgs);
      const user = authenticated(context);
      if (!["admin", "operator", "employee", "recruiter"].includes(user.role)) throw new AppError(403, "SALES_ACCESS_FORBIDDEN", "Your role cannot access sales performance");
      const rows = await db.select({ salespersonId: sales.salespersonId, firstName: users.firstName, lastName: users.lastName, status: sales.status, salePriceCents: sales.salePriceCents, grossProfitCents: sales.grossProfitCents, commissionAmountCents: sales.commissionAmountCents }).from(sales).innerJoin(users, eq(sales.salespersonId, users.id)).where(and(salesVisibility(user, workspaceFor(user)), gte(sales.soldAt, periodStart(args.period))));
      const funded = rows.filter((row) => row.status === "funded");
      const byPerson = new Map<string, { name: string; funded: number; revenueCents: number; grossProfitCents: number; commissionCents: number }>();
      for (const row of funded) { const current = byPerson.get(row.salespersonId) ?? { name: `${row.firstName ?? "Team"} ${row.lastName ?? "member"}`, funded: 0, revenueCents: 0, grossProfitCents: 0, commissionCents: 0 }; current.funded += 1; current.revenueCents += row.salePriceCents; current.grossProfitCents += row.grossProfitCents; current.commissionCents += row.commissionAmountCents; byPerson.set(row.salespersonId, current); }
      return { period: args.period, total: rows.length, funded: funded.length, revenueCents: funded.reduce((sum, row) => sum + row.salePriceCents, 0), grossProfitCents: funded.reduce((sum, row) => sum + row.grossProfitCents, 0), commissionCents: funded.reduce((sum, row) => sum + row.commissionAmountCents, 0), salespeople: [...byPerson.values()].sort((a, b) => b.grossProfitCents - a.grossProfitCents) };
    },
  ),
  tool(
    "troubleshootScraping",
    "Diagnose persisted source and acquisition-run health and suggest manual next checks without triggering a scrape.",
    troubleshootingArgs,
    { type: "object", properties: { runId: { type: "string", format: "uuid" } } },
    async (rawArgs, context) => {
      const args = troubleshootingArgs.parse(rawArgs);
      const user = authenticated(context);
      if (!["admin", "operator", "recruiter"].includes(user.role)) throw new AppError(403, "SCRAPE_STATUS_FORBIDDEN", "Your role cannot access scraping operations");
      const sourceHealth = await db.select({ key: sources.key, name: sources.name, enabled: sources.enabled, liveEnabled: sources.liveEnabled, latestStatus: sql<string | null>`(select sr.status::text from ${sourceRuns} sr where sr.source_id = ${sources.id} order by sr.created_at desc limit 1)` }).from(sources).orderBy(sources.name);
      const runs = args.runId
        ? await db.select({ id: scrapeRuns.id, status: scrapeRuns.status, failedSourceCount: scrapeRuns.failedSourceCount, discoveredCount: scrapeRuns.discoveredCount, createdAt: scrapeRuns.createdAt, finishedAt: scrapeRuns.finishedAt }).from(scrapeRuns).where(eq(scrapeRuns.id, args.runId)).limit(1)
        : await db.select({ id: scrapeRuns.id, status: scrapeRuns.status, failedSourceCount: scrapeRuns.failedSourceCount, discoveredCount: scrapeRuns.discoveredCount, createdAt: scrapeRuns.createdAt, finishedAt: scrapeRuns.finishedAt }).from(scrapeRuns).orderBy(desc(scrapeRuns.createdAt)).limit(1);
      const run = runs[0] ?? null;
      const disabled = sourceHealth.filter((source) => !source.enabled).length;
      const failedSources = sourceHealth.filter((source) => source.latestStatus === "failed" || source.latestStatus === "dead_letter").length;
      const checks = [
        ...(disabled ? [`Review ${disabled} disabled source${disabled === 1 ? "" : "s"} in source control.`] : []),
        ...(failedSources ? [`Review the latest error for ${failedSources} failed source${failedSources === 1 ? "" : "s"}.`] : []),
        ...(run?.status === "failed" || run?.status === "partial" ? ["Inspect the persisted run and source-run errors before manually retrying."] : []),
        ...(run && run.discoveredCount === 0 ? ["Check source availability and filters; the latest run discovered no listings."] : []),
      ];
      return { sourceHealth, run, checks: checks.length ? checks : ["No persisted failure signal is currently visible. Confirm the source configuration and run history if the issue continues."], manualOnly: true };
    },
  ),
  tool(
    "getScrapingStatus",
    "Return authorized source health and recent acquisition run status without triggering any job.",
    runArgs,
    { type: "object", properties: { runId: { type: "string", format: "uuid" } } },
    async (rawArgs, context) => {
      const args = runArgs.parse(rawArgs);
      const user = authenticated(context);
      if (!["admin", "operator", "recruiter"].includes(user.role)) throw new AppError(403, "SCRAPE_STATUS_FORBIDDEN", "Your role cannot access scraping operations");
      const sourceHealth = await db.select({ key: sources.key, name: sources.name, enabled: sources.enabled, liveEnabled: sources.liveEnabled, lastSuccessAt: sources.lastSuccessAt, lastFailureAt: sources.lastFailureAt, latestStatus: sql<string | null>`(select sr.status::text from ${sourceRuns} sr where sr.source_id = ${sources.id} order by sr.created_at desc limit 1)` }).from(sources).orderBy(sources.name);
      if (!args.runId) return { sourceHealth, recentRuns: await db.select({ id: scrapeRuns.id, mode: scrapeRuns.mode, status: scrapeRuns.status, sourceCount: scrapeRuns.sourceCount, completedSourceCount: scrapeRuns.completedSourceCount, failedSourceCount: scrapeRuns.failedSourceCount, discoveredCount: scrapeRuns.discoveredCount, createdAt: scrapeRuns.createdAt, finishedAt: scrapeRuns.finishedAt }).from(scrapeRuns).orderBy(desc(scrapeRuns.createdAt)).limit(5) };
      const [run] = await db.select({ id: scrapeRuns.id, mode: scrapeRuns.mode, status: scrapeRuns.status, sourceCount: scrapeRuns.sourceCount, completedSourceCount: scrapeRuns.completedSourceCount, failedSourceCount: scrapeRuns.failedSourceCount, discoveredCount: scrapeRuns.discoveredCount, insertedCount: scrapeRuns.insertedCount, updatedCount: scrapeRuns.updatedCount, rejectedCount: scrapeRuns.rejectedCount, createdAt: scrapeRuns.createdAt, finishedAt: scrapeRuns.finishedAt }).from(scrapeRuns).where(eq(scrapeRuns.id, args.runId)).limit(1);
      if (!run) throw new AppError(404, "RUN_NOT_FOUND", "That acquisition run is not available");
      return { run };
    },
  ),
];

const toolsByName = new Map(assistantTools.map((assistantTool) => [assistantTool.definition.function.name, assistantTool]));

export function getAssistantTool(name: string): AssistantTool | undefined {
  return toolsByName.get(name);
}

export function availableAssistantTools(isAuthenticated: boolean): AssistantTool[] {
  return assistantTools.filter((assistantTool) => assistantTool.public || isAuthenticated);
}
