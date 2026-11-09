import { createHash } from "node:crypto";
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import {
  requireCsrf,
  requirePermission,
  requireRoles,
  requireSession,
  requireWorkspace,
} from "../../auth/session.js";
import type { AuthenticatedUser } from "../../auth/session.js";
import { db } from "../../db/client.js";
import {
  auditEvents,
  financeProviders,
  idempotencyRecords,
  leadActivities,
  leads,
  leadSources,
  monthlyTargets,
  sales,
  users,
  workspaces,
} from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import { dealershipAdminRouter } from "./admin-routes.js";
import { documentRouter } from "./document-routes.js";

const uuidSchema = z.string().uuid();
const roleSchema = z.enum([
  "operator",
  "viewer",
  "admin",
  "employee",
  "virtual_assistant",
  "recruiter",
]);
const leadStatusSchema = z.enum(["new", "contacted", "qualified", "converted", "lost"]);

const leadInputSchema = z.object({
  sourceId: z.string().uuid().nullable().optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  externalReference: z.string().trim().min(1).max(100).optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).nullable().optional(),
  phone: z.string().trim().min(7).max(40).nullable().optional(),
  vehicleInterest: z.string().trim().max(200).nullable().optional(),
  status: leadStatusSchema.default("new"),
  notes: z.string().trim().max(4_000).nullable().optional(),
});

const leadUpdateSchema = leadInputSchema.partial().extend({
  version: z.number().int().min(1),
});

const saleInputSchema = z.object({
  salespersonId: z.string().uuid().optional(),
  leadId: z.string().uuid().nullable().optional(),
  financeProviderId: z.string().uuid().nullable().optional(),
  externalSaleId: z.string().trim().min(1).max(100),
  type: z.enum(["retail", "wholesale"]),
  status: z.enum(["draft", "submitted", "approved", "rejected", "funded", "cancelled"]).default("submitted"),
  customerName: z.string().trim().min(2).max(160),
  customerEmail: z.string().trim().email().max(254).nullable().optional(),
  customerPhone: z.string().trim().min(7).max(40).nullable().optional(),
  vehicleVin: z.string().trim().min(11).max(17).nullable().optional(),
  vehicleDescription: z.string().trim().min(2).max(240),
  salePriceCents: z.number().int().nonnegative().max(200_000_000),
  grossProfitCents: z.number().int().min(-20_000_000).max(100_000_000),
  commissionRateBasisPoints: z.number().int().min(0).max(10_000),
  soldAt: z.coerce.date(),
  notes: z.string().trim().max(4_000).nullable().optional(),
});

const saleUpdateSchema = saleInputSchema.partial().extend({
  version: z.number().int().min(1),
});
type SaleStatus = z.infer<typeof saleInputSchema>["status"];

const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: leadStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(500).optional(),
});

interface Cursor {
  createdAt: string;
  id: string;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string | undefined): Cursor | undefined {
  if (!value) return undefined;
  try {
    return z.object({ createdAt: z.string().datetime(), id: z.string().uuid() })
      .parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "The pagination cursor is invalid");
  }
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireIdempotencyKey(header: string | undefined): string {
  const result = z.string().trim().min(8).max(200).safeParse(header);
  if (!result.success) {
    throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required");
  }
  return result.data;
}

function visibleToUser(user: AuthenticatedUser, workspaceId: string): SQL {
  if (user.role === "employee") {
    return and(eq(leads.workspaceId, workspaceId), eq(leads.assignedToUserId, user.id))!;
  }
  return eq(leads.workspaceId, workspaceId);
}

type LeadReferenceInput = {
  sourceId?: string | null | undefined;
  assignedToUserId?: string | null | undefined;
};

async function validateLeadReferences(input: LeadReferenceInput, workspaceId: string, user: AuthenticatedUser) {
  if (user.role === "employee" && input.assignedToUserId !== undefined && input.assignedToUserId !== user.id) {
    throw new AppError(403, "LEAD_ASSIGNMENT_FORBIDDEN", "Salespeople can only own their assigned leads");
  }

  const [source, assignee] = await Promise.all([
    input.sourceId
      ? db.select({ id: leadSources.id }).from(leadSources)
        .where(and(eq(leadSources.id, input.sourceId), eq(leadSources.workspaceId, workspaceId), eq(leadSources.isActive, true))).limit(1)
      : Promise.resolve([]),
    input.assignedToUserId
      ? db.select({ id: users.id }).from(users)
        .where(and(eq(users.id, input.assignedToUserId), eq(users.workspaceId, workspaceId), eq(users.isActive, true))).limit(1)
      : Promise.resolve([]),
  ]);

  if (input.sourceId && !source[0]) {
    throw new AppError(400, "INVALID_LEAD_SOURCE", "Lead source is not active in this workspace");
  }
  if (input.assignedToUserId && !assignee[0]) {
    throw new AppError(400, "INVALID_LEAD_ASSIGNEE", "Lead assignee is not an active workspace member");
  }
}

function assertEmployeeSaleStatus(user: AuthenticatedUser, status: SaleStatus | undefined, existingStatus?: SaleStatus): void {
  if (user.role !== "employee") return;
  const allowed = status === undefined || status === "draft" || status === "submitted";
  if (!allowed) {
    throw new AppError(403, "SALE_STATUS_FORBIDDEN", "Salespeople can only submit draft or submitted deals");
  }
  if (existingStatus && existingStatus !== "draft" && existingStatus !== "submitted") {
    throw new AppError(409, "SALE_LOCKED", "This sale is locked after approval and cannot be edited by a salesperson");
  }
}

export const dealershipRouter = Router();
dealershipRouter.use(requireSession);
dealershipRouter.use("/admin", dealershipAdminRouter);
dealershipRouter.use("/documents", documentRouter);

dealershipRouter.get(
  "/bootstrap",
  requireRoles("admin", "employee", "virtual_assistant", "recruiter"),
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const [workspace, team, sourcesData, providers] = await Promise.all([
      db.select({ id: workspaces.id, name: workspaces.name, mode: workspaces.mode })
        .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
      db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, role: users.role, isActive: users.isActive })
        .from(users).where(eq(users.workspaceId, workspaceId)).orderBy(users.firstName, users.lastName),
      db.select({ id: leadSources.id, name: leadSources.name })
        .from(leadSources).where(and(eq(leadSources.workspaceId, workspaceId), eq(leadSources.isActive, true))).orderBy(leadSources.name),
      db.select({ id: financeProviders.id, name: financeProviders.name })
        .from(financeProviders).where(and(eq(financeProviders.workspaceId, workspaceId), eq(financeProviders.isActive, true))).orderBy(financeProviders.name),
    ]);
    if (!workspace[0]) throw new AppError(404, "WORKSPACE_NOT_FOUND", "Workspace was not found");
    response.json({ data: { workspace: workspace[0], user: request.user, team, leadSources: sourcesData, financeProviders: providers } });
  }),
);

dealershipRouter.get(
  "/summary",
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const leadScope = visibleToUser(request.user!, workspaceId);
    const salesVisible = ["admin", "employee", "recruiter"].includes(request.user!.role);
    const saleScope = !salesVisible
      ? sql`false`
      : request.user!.role === "employee"
        ? and(eq(sales.workspaceId, workspaceId), eq(sales.salespersonId, request.user!.id))!
        : eq(sales.workspaceId, workspaceId);

    const [leadMetrics, saleMetrics, targetRows, recentLeadRows, recentSaleRows] = await Promise.all([
      db.select({
        total: sql<number>`count(*)::int`,
        new: sql<number>`count(*) filter (where ${leads.status} = 'new')::int`,
        qualified: sql<number>`count(*) filter (where ${leads.status} = 'qualified')::int`,
        converted: sql<number>`count(*) filter (where ${leads.status} = 'converted')::int`,
      }).from(leads).where(leadScope),
      db.select({
        total: sql<number>`count(*)::int`,
        funded: sql<number>`count(*) filter (where ${sales.status} = 'funded')::int`,
        revenueCents: sql<number>`coalesce(sum(${sales.salePriceCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`.mapWith(Number),
        grossProfitCents: sql<number>`coalesce(sum(${sales.grossProfitCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`.mapWith(Number),
        commissionCents: sql<number>`coalesce(sum(${sales.commissionAmountCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`.mapWith(Number),
      }).from(sales).where(and(saleScope, sql`${sales.soldAt} >= ${monthStart}`)),
      db.select().from(monthlyTargets).where(and(
        eq(monthlyTargets.workspaceId, workspaceId),
        eq(monthlyTargets.month, month),
        !salesVisible
          ? sql`false`
          : request.user!.role === "employee"
          ? eq(monthlyTargets.userId, request.user!.id)
          : sql`true`,
      )).limit(1),
      db.select({ id: leads.id, firstName: leads.firstName, lastName: leads.lastName, status: leads.status, vehicleInterest: leads.vehicleInterest, createdAt: leads.createdAt })
        .from(leads).where(leadScope).orderBy(desc(leads.createdAt)).limit(5),
      db.select({ id: sales.id, externalSaleId: sales.externalSaleId, customerName: sales.customerName, vehicleDescription: sales.vehicleDescription, status: sales.status, salePriceCents: sales.salePriceCents, soldAt: sales.soldAt })
        .from(sales).where(saleScope).orderBy(desc(sales.soldAt)).limit(5),
    ]);

    response.json({
      data: {
        period: month,
        leads: leadMetrics[0] ?? { total: 0, new: 0, qualified: 0, converted: 0 },
        sales: saleMetrics[0] ?? { total: 0, funded: 0, revenueCents: 0, grossProfitCents: 0, commissionCents: 0 },
        target: targetRows[0] ?? null,
        recentLeads: recentLeadRows,
        recentSales: recentSaleRows,
      },
    });
  }),
);

dealershipRouter.get(
  "/analytics",
  requireRoles("admin", "employee", "recruiter"),
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const now = new Date();
    const rangeStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const leadScope = visibleToUser(request.user!, workspaceId);
    const saleScope = request.user!.role === "employee"
      ? and(eq(sales.workspaceId, workspaceId), eq(sales.salespersonId, request.user!.id))!
      : eq(sales.workspaceId, workspaceId);
    const salesMonth = sql`date_trunc('month', ${sales.soldAt} AT TIME ZONE 'UTC')`;
    const leadsMonth = sql`date_trunc('month', ${leads.createdAt} AT TIME ZONE 'UTC')`;
    const leadSource = sql<string>`coalesce(${leadSources.name}, 'Unattributed')`;

    const [monthlySales, monthlyLeads, leadPipeline, leadSourcesSummary] = await Promise.all([
      db.select({
        month: sql<string>`to_char(${salesMonth}, 'YYYY-MM')`,
        fundedSales: sql<number>`count(*)::int`,
        revenueCents: sql<number>`coalesce(sum(${sales.salePriceCents}), 0)::bigint`,
        grossProfitCents: sql<number>`coalesce(sum(${sales.grossProfitCents}), 0)::bigint`,
      }).from(sales).where(and(
        saleScope,
        eq(sales.status, "funded"),
        gte(sales.soldAt, rangeStart),
      )).groupBy(salesMonth).orderBy(salesMonth),
      db.select({
        month: sql<string>`to_char(${leadsMonth}, 'YYYY-MM')`,
        total: sql<number>`count(*)::int`,
        converted: sql<number>`count(*) filter (where ${leads.status} = 'converted')::int`,
      }).from(leads).where(and(leadScope, gte(leads.createdAt, rangeStart)))
        .groupBy(leadsMonth).orderBy(leadsMonth),
      db.select({
        status: leads.status,
        count: sql<number>`count(*)::int`,
      }).from(leads).where(leadScope).groupBy(leads.status),
      db.select({
        source: leadSource,
        count: sql<number>`count(*)::int`,
      }).from(leads).leftJoin(leadSources, eq(leads.sourceId, leadSources.id))
        .where(and(leadScope, gte(leads.createdAt, rangeStart)))
        .groupBy(leadSource).orderBy(desc(sql`count(*)`)).limit(6),
    ]);

    response.json({
      data: {
        period: "last_6_months",
        monthlySales: monthlySales.map((month) => ({
          ...month,
          revenueCents: Number(month.revenueCents),
          grossProfitCents: Number(month.grossProfitCents),
        })),
        monthlyLeads,
        leadPipeline,
        leadSources: leadSourcesSummary,
      },
    });
  }),
);

dealershipRouter.get(
  "/leads",
  requireRoles("admin", "employee", "virtual_assistant", "recruiter"),
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const query = listQuerySchema.parse(request.query);
    const cursor = decodeCursor(query.cursor);
    const conditions: SQL[] = [visibleToUser(request.user!, workspaceId)];
    if (query.status) conditions.push(eq(leads.status, query.status));
    if (query.q) {
      const search = `%${query.q}%`;
      conditions.push(or(ilike(leads.firstName, search), ilike(leads.lastName, search), ilike(leads.email, search), ilike(leads.vehicleInterest, search))!);
    }
    if (cursor) {
      const cursorDate = new Date(cursor.createdAt);
      conditions.push(or(lt(leads.createdAt, cursorDate), and(eq(leads.createdAt, cursorDate), lt(leads.id, cursor.id)))!);
    }

    const rows = await db.select({
      id: leads.id,
      sourceId: leads.sourceId,
      assignedToUserId: leads.assignedToUserId,
      externalReference: leads.externalReference,
      firstName: leads.firstName,
      lastName: leads.lastName,
      email: leads.email,
      phone: leads.phone,
      vehicleInterest: leads.vehicleInterest,
      status: leads.status,
      notes: leads.notes,
      version: leads.version,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    }).from(leads).where(and(...conditions)).orderBy(desc(leads.createdAt), desc(leads.id)).limit(query.limit + 1);

    const hasNext = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    response.json({
      data: items,
      page: { limit: query.limit, hasNext, nextCursor: hasNext && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null },
    });
  }),
);

dealershipRouter.post(
  "/leads",
  requireRoles("admin", "operator", "employee", "virtual_assistant", "recruiter"),
  requirePermission("dealership.leads.write"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const parsed = leadInputSchema.parse(request.body);
    const input = {
      ...parsed,
      assignedToUserId: request.user!.role === "employee" ? request.user!.id : parsed.assignedToUserId ?? null,
    };
    await validateLeadReferences(input, workspaceId, request.user!);
    const key = requireIdempotencyKey(request.header("idempotency-key"));
    const hash = requestHash(input);

    const result = await db.transaction(async (tx) => {
      const [lock] = await tx.insert(idempotencyRecords).values({
        workspaceId,
        userId: request.user!.id,
        operation: "lead.create",
        key,
        requestHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }).onConflictDoNothing().returning({ id: idempotencyRecords.id });

      if (!lock) {
        const [existing] = await tx.select({ requestHash: idempotencyRecords.requestHash, responseBody: idempotencyRecords.responseBody })
          .from(idempotencyRecords)
          .where(and(eq(idempotencyRecords.workspaceId, workspaceId), eq(idempotencyRecords.operation, "lead.create"), eq(idempotencyRecords.key, key)))
          .limit(1);
        if (!existing || existing.requestHash !== hash) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was used for a different request");
        if (!existing.responseBody) throw new AppError(409, "REQUEST_IN_PROGRESS", "An identical request is already being processed");
        return { body: existing.responseBody, reused: true };
      }

      const [created] = await tx.insert(leads).values({
        ...input,
        workspaceId,
        createdByUserId: request.user!.id,
        contactedAt: input.status === "contacted" ? new Date() : null,
        convertedAt: input.status === "converted" ? new Date() : null,
      }).returning();
      if (!created) throw new Error("Failed to create lead");
      await tx.insert(leadActivities).values({ workspaceId, leadId: created.id, actorUserId: request.user!.id, type: "created", note: "Lead created" });
      const body = { id: created.id, version: created.version };
      await tx.update(idempotencyRecords).set({ responseStatus: 201, responseBody: body }).where(eq(idempotencyRecords.id, lock.id));
      await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "lead.created", entityType: "lead", entityId: created.id });
      return { body, reused: false };
    });

    response.status(result.reused ? 200 : 201).json({ data: result.body, meta: { idempotentReplay: result.reused } });
  }),
);

dealershipRouter.patch(
  "/leads/:id",
  requireRoles("admin", "operator", "employee", "virtual_assistant", "recruiter"),
  requirePermission("dealership.leads.write"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuidSchema.parse(request.params.id);
    const { version, ...parsed } = leadUpdateSchema.parse(request.body);
    await validateLeadReferences(parsed, workspaceId, request.user!);
    const input = request.user!.role === "employee" && parsed.assignedToUserId !== undefined
      ? { ...parsed, assignedToUserId: request.user!.id }
      : parsed;
    const access = visibleToUser(request.user!, workspaceId);
    const updated = await db.transaction(async (tx) => {
      const [updatedLead] = await tx.update(leads).set({
        ...input,
        ...(input.status === "contacted" ? { contactedAt: new Date() } : {}),
        ...(input.status === "converted" ? { convertedAt: new Date() } : {}),
        version: version + 1,
        updatedAt: new Date(),
      }).where(and(access, eq(leads.id, id), eq(leads.version, version))).returning();
      if (!updatedLead) throw new AppError(409, "STALE_WRITE", "This lead changed after you opened it; refresh and try again");
      await tx.insert(leadActivities).values({
        workspaceId,
        leadId: id,
        actorUserId: request.user!.id,
        type: input.status !== undefined ? "status_changed" : "internal_note",
        note: input.status !== undefined ? `Lead status changed to ${input.status}` : "Lead details updated",
      });
      await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "lead.updated", entityType: "lead", entityId: id, metadata: { version: updatedLead.version } });
      return updatedLead;
    });
    response.json({ data: updated });
  }),
);

dealershipRouter.get(
  "/sales",
  requireRoles("admin", "operator", "employee", "recruiter"),
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit);
    const scope = request.user!.role === "employee"
      ? and(eq(sales.workspaceId, workspaceId), eq(sales.salespersonId, request.user!.id))!
      : eq(sales.workspaceId, workspaceId);
    const rows = await db.select().from(sales).where(scope).orderBy(desc(sales.soldAt), desc(sales.id)).limit(limit);
    response.json({ data: rows });
  }),
);

dealershipRouter.post(
  "/sales",
  requireRoles("admin", "operator", "employee", "recruiter"),
  requirePermission("dealership.sales.write"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = saleInputSchema.parse(request.body);
    assertEmployeeSaleStatus(request.user!, input.status);
    const key = requireIdempotencyKey(request.header("idempotency-key"));
    const hash = requestHash(input);
    const salespersonId = request.user!.role === "employee" ? request.user!.id : input.salespersonId;
    if (!salespersonId) throw new AppError(400, "SALESPERSON_REQUIRED", "A salesperson is required");
    const [salesperson] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.id, salespersonId), eq(users.workspaceId, workspaceId), eq(users.isActive, true))).limit(1);
    if (!salesperson) throw new AppError(400, "INVALID_SALESPERSON", "Salesperson is not an active workspace member");
    if (input.leadId) {
      const [relatedLead] = await db.select({ id: leads.id }).from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.workspaceId, workspaceId))).limit(1);
      if (!relatedLead) throw new AppError(400, "INVALID_SALE_LEAD", "Lead does not belong to this workspace");
    }
    if (input.financeProviderId) {
      const [provider] = await db.select({ id: financeProviders.id }).from(financeProviders)
        .where(and(eq(financeProviders.id, input.financeProviderId), eq(financeProviders.workspaceId, workspaceId), eq(financeProviders.isActive, true))).limit(1);
      if (!provider) throw new AppError(400, "INVALID_FINANCE_PROVIDER", "Finance provider is not active in this workspace");
    }
    const commissionAmountCents = Math.round(input.grossProfitCents * input.commissionRateBasisPoints / 10_000);

    const result = await db.transaction(async (tx) => {
      const [lock] = await tx.insert(idempotencyRecords).values({
        workspaceId, userId: request.user!.id, operation: "sale.create", key, requestHash: hash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }).onConflictDoNothing().returning({ id: idempotencyRecords.id });
      if (!lock) {
        const [existing] = await tx.select({ requestHash: idempotencyRecords.requestHash, responseBody: idempotencyRecords.responseBody })
          .from(idempotencyRecords).where(and(eq(idempotencyRecords.workspaceId, workspaceId), eq(idempotencyRecords.operation, "sale.create"), eq(idempotencyRecords.key, key))).limit(1);
        if (!existing || existing.requestHash !== hash) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "This idempotency key was used for a different request");
        if (!existing.responseBody) throw new AppError(409, "REQUEST_IN_PROGRESS", "An identical request is already being processed");
        return { body: existing.responseBody, reused: true };
      }
      const [created] = await tx.insert(sales).values({
        ...input, workspaceId, salespersonId, createdByUserId: request.user!.id, commissionAmountCents,
      }).returning({ id: sales.id, version: sales.version });
      if (!created) throw new Error("Failed to create sale");
      await tx.update(idempotencyRecords).set({ responseStatus: 201, responseBody: created }).where(eq(idempotencyRecords.id, lock.id));
      await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "sale.created", entityType: "sale", entityId: created.id });
      return { body: created, reused: false };
    });
    response.status(result.reused ? 200 : 201).json({ data: result.body, meta: { idempotentReplay: result.reused } });
  }),
);

dealershipRouter.patch(
  "/sales/:id",
  requireRoles("admin", "operator", "employee", "recruiter"),
  requirePermission("dealership.sales.write"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuidSchema.parse(request.params.id);
    const { version, ...input } = saleUpdateSchema.parse(request.body);
    const scope = request.user!.role === "employee"
      ? and(eq(sales.workspaceId, workspaceId), eq(sales.salespersonId, request.user!.id))!
      : eq(sales.workspaceId, workspaceId);

    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(sales)
        .where(and(scope, eq(sales.id, id)))
        .limit(1);
      if (!existing) throw new AppError(404, "SALE_NOT_FOUND", "Sale was not found");
      if (existing.version !== version) {
        throw new AppError(409, "STALE_WRITE", "This sale changed after you opened it; refresh and try again");
      }
      assertEmployeeSaleStatus(request.user!, input.status, existing.status);

      const salespersonId = request.user!.role === "employee"
        ? request.user!.id
        : input.salespersonId ?? existing.salespersonId;
      const leadId = input.leadId === undefined ? existing.leadId : input.leadId;
      const financeProviderId = input.financeProviderId === undefined
        ? existing.financeProviderId
        : input.financeProviderId;

      const [salesperson, relatedLead, provider] = await Promise.all([
        tx.select({ id: users.id }).from(users)
          .where(and(eq(users.id, salespersonId), eq(users.workspaceId, workspaceId), eq(users.isActive, true))).limit(1),
        leadId
          ? tx.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), eq(leads.workspaceId, workspaceId))).limit(1)
          : Promise.resolve([]),
        financeProviderId
          ? tx.select({ id: financeProviders.id }).from(financeProviders)
              .where(and(eq(financeProviders.id, financeProviderId), eq(financeProviders.workspaceId, workspaceId), eq(financeProviders.isActive, true))).limit(1)
          : Promise.resolve([]),
      ]);
      if (!salesperson[0]) throw new AppError(400, "INVALID_SALESPERSON", "Salesperson is not an active workspace member");
      if (leadId && !relatedLead[0]) throw new AppError(400, "INVALID_SALE_LEAD", "Lead does not belong to this workspace");
      if (financeProviderId && !provider[0]) throw new AppError(400, "INVALID_FINANCE_PROVIDER", "Finance provider is not active in this workspace");

      const grossProfitCents = input.grossProfitCents ?? existing.grossProfitCents;
      const commissionRateBasisPoints = input.commissionRateBasisPoints ?? existing.commissionRateBasisPoints;
      const [sale] = await tx.update(sales).set({
        ...input,
        salespersonId,
        leadId,
        financeProviderId,
        commissionAmountCents: Math.round(grossProfitCents * commissionRateBasisPoints / 10_000),
        version: version + 1,
        updatedAt: new Date(),
      }).where(and(eq(sales.id, id), eq(sales.version, version))).returning();
      if (!sale) throw new AppError(409, "STALE_WRITE", "This sale changed after you opened it; refresh and try again");

      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: request.user!.id,
        action: "sale.updated",
        entityType: "sale",
        entityId: id,
        metadata: { version: sale.version, status: sale.status },
      });
      return sale;
    });

    response.json({ data: updated });
  }),
);

dealershipRouter.get(
  "/roles",
  requireRoles("admin", "operator", "recruiter"),
  (_request, response) => response.json({ data: roleSchema.options }),
);

dealershipRouter.get(
  "/audit-events",
  requireRoles("admin", "recruiter"),
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit);
    const rows = await db.select({
      id: auditEvents.id,
      action: auditEvents.action,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      metadata: auditEvents.metadata,
      createdAt: auditEvents.createdAt,
      actorUserId: auditEvents.actorUserId,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
      actorEmail: users.email,
    }).from(auditEvents).leftJoin(users, eq(auditEvents.actorUserId, users.id))
      .where(eq(auditEvents.workspaceId, workspaceId)).orderBy(desc(auditEvents.createdAt)).limit(limit);
    response.json({ data: rows });
  }),
);
