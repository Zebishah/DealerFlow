import { createHash } from "node:crypto";
import { and, desc, eq, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import {
  requireCsrf,
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

export const dealershipRouter = Router();
dealershipRouter.use(requireSession);
dealershipRouter.use("/admin", dealershipAdminRouter);

dealershipRouter.get(
  "/bootstrap",
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
    const saleScope = request.user!.role === "employee"
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
        revenueCents: sql<number>`coalesce(sum(${sales.salePriceCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`,
        grossProfitCents: sql<number>`coalesce(sum(${sales.grossProfitCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`,
        commissionCents: sql<number>`coalesce(sum(${sales.commissionAmountCents}) filter (where ${sales.status} = 'funded'), 0)::bigint`,
      }).from(sales).where(and(saleScope, sql`${sales.soldAt} >= ${monthStart}`)),
      db.select().from(monthlyTargets).where(and(
        eq(monthlyTargets.workspaceId, workspaceId),
        eq(monthlyTargets.month, month),
        request.user!.role === "employee" ? eq(monthlyTargets.userId, request.user!.id) : sql`true`,
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
  "/leads",
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
  requireRoles("admin", "operator", "employee", "virtual_assistant"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = leadInputSchema.parse(request.body);
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
  requireRoles("admin", "operator", "employee", "virtual_assistant"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuidSchema.parse(request.params.id);
    const { version, ...input } = leadUpdateSchema.parse(request.body);
    const access = visibleToUser(request.user!, workspaceId);
    const [updated] = await db.update(leads).set({
      ...input,
      ...(input.status === "contacted" ? { contactedAt: new Date() } : {}),
      ...(input.status === "converted" ? { convertedAt: new Date() } : {}),
      version: version + 1,
      updatedAt: new Date(),
    }).where(and(access, eq(leads.id, id), eq(leads.version, version))).returning();
    if (!updated) throw new AppError(409, "STALE_WRITE", "This lead changed after you opened it; refresh and try again");
    await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "lead.updated", entityType: "lead", entityId: id, metadata: { version: updated.version } });
    response.json({ data: updated });
  }),
);

dealershipRouter.get(
  "/sales",
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
  requireRoles("admin", "operator", "employee"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = saleInputSchema.parse(request.body);
    const key = requireIdempotencyKey(request.header("idempotency-key"));
    const hash = requestHash(input);
    const salespersonId = request.user!.role === "employee" ? request.user!.id : input.salespersonId;
    if (!salespersonId) throw new AppError(400, "SALESPERSON_REQUIRED", "A salesperson is required");
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
  requireRoles("admin", "operator", "employee"),
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
