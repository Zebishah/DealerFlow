import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { hashPassword } from "../../auth/password.js";
import { requireCsrf, requireRoles, requireWorkspace } from "../../auth/session.js";
import { db } from "../../db/client.js";
import {
  auditEvents,
  commissionRules,
  financeProviders,
  leadSources,
  monthlyTargets,
  sessions,
  users,
} from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import { adminAccessRequestRouter } from "../access-requests/routes.js";

const uuidSchema = z.string().uuid();
const workspaceRoleSchema = z.enum(["viewer", "admin", "employee", "virtual_assistant", "recruiter"]);
const userCreateSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(14).max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: workspaceRoleSchema,
});
const userUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  role: workspaceRoleSchema.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(14).max(200).optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one change is required");

const namedResourceSchema = z.object({ name: z.string().trim().min(2).max(100) });
const namedResourceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one change is required");

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must use YYYY-MM");
const targetSchema = z.object({
  userId: z.string().uuid().nullable(),
  month: monthSchema,
  retailTarget: z.number().int().min(0).max(1_000),
  wholesaleTarget: z.number().int().min(0).max(1_000),
  grossProfitTargetCents: z.number().int().min(0).max(2_000_000_000),
});
const commissionCreateSchema = z.object({
  userId: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(120),
  retailRateBasisPoints: z.number().int().min(0).max(10_000),
  wholesaleRateBasisPoints: z.number().int().min(0).max(10_000),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().nullable().optional(),
}).refine((value) => !value.effectiveTo || value.effectiveTo > value.effectiveFrom, {
  path: ["effectiveTo"],
  message: "Effective end must be after the start",
});
const commissionUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  retailRateBasisPoints: z.number().int().min(0).max(10_000).optional(),
  wholesaleRateBasisPoints: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one change is required");

export const dealershipAdminRouter = Router();
dealershipAdminRouter.use(requireRoles("admin"));
dealershipAdminRouter.use("/access-requests", adminAccessRequestRouter);

dealershipAdminRouter.get(
  "/users",
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const rows = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    }).from(users).where(eq(users.workspaceId, workspaceId)).orderBy(users.firstName, users.lastName, users.email);
    response.json({ data: rows });
  }),
);

dealershipAdminRouter.post(
  "/users",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = userCreateSchema.parse(request.body);
    const email = input.email.toLowerCase();
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existing) throw new AppError(409, "EMAIL_IN_USE", "A user with this email already exists");

    const passwordHash = await hashPassword(input.password);
    const created = await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        workspaceId,
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
      }).returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });
      if (!user) throw new Error("Failed to create user");
      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: request.user!.id,
        action: "user.created",
        entityType: "user",
        entityId: user.id,
        metadata: { role: user.role },
      });
      return user;
    });
    response.status(201).json({ data: created });
  }),
);

dealershipAdminRouter.patch(
  "/users/:id",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuidSchema.parse(request.params.id);
    const input = userUpdateSchema.parse(request.body);
    if (id === request.user!.id && (input.isActive === false || (input.role && input.role !== "admin"))) {
      throw new AppError(400, "SELF_LOCKOUT_BLOCKED", "You cannot deactivate or remove your own administrator access");
    }
    const passwordHash = input.password ? await hashPassword(input.password) : undefined;
    const updated = await db.transaction(async (tx) => {
      const [user] = await tx.update(users).set({
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        isActive: input.isActive,
        ...(passwordHash ? { passwordHash } : {}),
        updatedAt: new Date(),
      }).where(and(eq(users.id, id), eq(users.workspaceId, workspaceId))).returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });
      if (!user) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
      if (input.isActive === false || passwordHash) {
        await tx.delete(sessions).where(eq(sessions.userId, id));
      }
      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: request.user!.id,
        action: "user.updated",
        entityType: "user",
        entityId: id,
        metadata: {
          role: user.role,
          isActive: user.isActive,
          passwordReset: Boolean(passwordHash),
        },
      });
      return user;
    });
    response.json({ data: updated });
  }),
);

dealershipAdminRouter.get(
  "/lead-sources",
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const rows = await db.select().from(leadSources).where(eq(leadSources.workspaceId, workspaceId)).orderBy(leadSources.name);
    response.json({ data: rows });
  }),
);

dealershipAdminRouter.post(
  "/lead-sources",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = namedResourceSchema.parse(request.body);
    const [existing] = await db.select({ id: leadSources.id }).from(leadSources)
      .where(and(eq(leadSources.workspaceId, workspaceId), sql`lower(${leadSources.name}) = ${input.name.toLowerCase()}`)).limit(1);
    if (existing) throw new AppError(409, "LEAD_SOURCE_EXISTS", "A lead source with this name already exists");
    const [created] = await db.insert(leadSources).values({ workspaceId, name: input.name }).returning();
    if (!created) throw new Error("Failed to create lead source");
    await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "lead_source.created", entityType: "lead_source", entityId: created.id });
    response.status(201).json({ data: created });
  }),
);

dealershipAdminRouter.patch(
  "/lead-sources/:id",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuidSchema.parse(request.params.id);
    const input = namedResourceUpdateSchema.parse(request.body);
    const [updated] = await db.update(leadSources).set({ ...input, updatedAt: new Date() })
      .where(and(eq(leadSources.id, id), eq(leadSources.workspaceId, workspaceId))).returning();
    if (!updated) throw new AppError(404, "LEAD_SOURCE_NOT_FOUND", "Lead source was not found");
    await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "lead_source.updated", entityType: "lead_source", entityId: id, metadata: { isActive: updated.isActive } });
    response.json({ data: updated });
  }),
);

dealershipAdminRouter.get(
  "/finance-providers",
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const rows = await db.select().from(financeProviders).where(eq(financeProviders.workspaceId, workspaceId)).orderBy(financeProviders.name);
    response.json({ data: rows });
  }),
);

dealershipAdminRouter.post(
  "/finance-providers",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = namedResourceSchema.parse(request.body);
    const [existing] = await db.select({ id: financeProviders.id }).from(financeProviders)
      .where(and(eq(financeProviders.workspaceId, workspaceId), sql`lower(${financeProviders.name}) = ${input.name.toLowerCase()}`)).limit(1);
    if (existing) throw new AppError(409, "FINANCE_PROVIDER_EXISTS", "A finance provider with this name already exists");
    const [created] = await db.insert(financeProviders).values({ workspaceId, name: input.name }).returning();
    if (!created) throw new Error("Failed to create finance provider");
    await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "finance_provider.created", entityType: "finance_provider", entityId: created.id });
    response.status(201).json({ data: created });
  }),
);

dealershipAdminRouter.patch(
  "/finance-providers/:id",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuidSchema.parse(request.params.id);
    const input = namedResourceUpdateSchema.parse(request.body);
    const [updated] = await db.update(financeProviders).set({ ...input, updatedAt: new Date() })
      .where(and(eq(financeProviders.id, id), eq(financeProviders.workspaceId, workspaceId))).returning();
    if (!updated) throw new AppError(404, "FINANCE_PROVIDER_NOT_FOUND", "Finance provider was not found");
    await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "finance_provider.updated", entityType: "finance_provider", entityId: id, metadata: { isActive: updated.isActive } });
    response.json({ data: updated });
  }),
);

dealershipAdminRouter.get(
  "/targets",
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const month = request.query.month === undefined ? undefined : monthSchema.parse(request.query.month);
    const condition = month
      ? and(eq(monthlyTargets.workspaceId, workspaceId), eq(monthlyTargets.month, month))
      : eq(monthlyTargets.workspaceId, workspaceId);
    const rows = await db.select({
      id: monthlyTargets.id,
      userId: monthlyTargets.userId,
      month: monthlyTargets.month,
      retailTarget: monthlyTargets.retailTarget,
      wholesaleTarget: monthlyTargets.wholesaleTarget,
      grossProfitTargetCents: monthlyTargets.grossProfitTargetCents,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      updatedAt: monthlyTargets.updatedAt,
    }).from(monthlyTargets).leftJoin(users, eq(monthlyTargets.userId, users.id)).where(condition).orderBy(desc(monthlyTargets.month), users.firstName);
    response.json({ data: rows });
  }),
);

dealershipAdminRouter.put(
  "/targets",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = targetSchema.parse(request.body);
    if (input.userId) {
      const [member] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.id, input.userId), eq(users.workspaceId, workspaceId))).limit(1);
      if (!member) throw new AppError(400, "INVALID_TARGET_USER", "Target user does not belong to this workspace");
    }
    const saved = await db.transaction(async (tx) => {
      const userCondition = input.userId ? eq(monthlyTargets.userId, input.userId) : isNull(monthlyTargets.userId);
      const [existing] = await tx.select({ id: monthlyTargets.id }).from(monthlyTargets)
        .where(and(eq(monthlyTargets.workspaceId, workspaceId), userCondition, eq(monthlyTargets.month, input.month))).limit(1);
      const [target] = existing
        ? await tx.update(monthlyTargets).set({
            retailTarget: input.retailTarget,
            wholesaleTarget: input.wholesaleTarget,
            grossProfitTargetCents: input.grossProfitTargetCents,
            updatedAt: new Date(),
          }).where(eq(monthlyTargets.id, existing.id)).returning()
        : await tx.insert(monthlyTargets).values({ workspaceId, ...input }).returning();
      if (!target) throw new Error("Failed to save target");
      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: request.user!.id,
        action: existing ? "target.updated" : "target.created",
        entityType: "monthly_target",
        entityId: target.id,
        metadata: { month: target.month, userId: target.userId },
      });
      return target;
    });
    response.json({ data: saved });
  }),
);

dealershipAdminRouter.get(
  "/commission-rules",
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const rows = await db.select({
      id: commissionRules.id,
      userId: commissionRules.userId,
      name: commissionRules.name,
      retailRateBasisPoints: commissionRules.retailRateBasisPoints,
      wholesaleRateBasisPoints: commissionRules.wholesaleRateBasisPoints,
      isActive: commissionRules.isActive,
      effectiveFrom: commissionRules.effectiveFrom,
      effectiveTo: commissionRules.effectiveTo,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      updatedAt: commissionRules.updatedAt,
    }).from(commissionRules).leftJoin(users, eq(commissionRules.userId, users.id))
      .where(eq(commissionRules.workspaceId, workspaceId)).orderBy(desc(commissionRules.effectiveFrom));
    response.json({ data: rows });
  }),
);

dealershipAdminRouter.post(
  "/commission-rules",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = commissionCreateSchema.parse(request.body);
    if (input.userId) {
      const [member] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.id, input.userId), eq(users.workspaceId, workspaceId))).limit(1);
      if (!member) throw new AppError(400, "INVALID_COMMISSION_USER", "Commission user does not belong to this workspace");
    }
    const [created] = await db.insert(commissionRules).values({ workspaceId, ...input, effectiveTo: input.effectiveTo ?? null }).returning();
    if (!created) throw new Error("Failed to create commission rule");
    await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "commission_rule.created", entityType: "commission_rule", entityId: created.id });
    response.status(201).json({ data: created });
  }),
);

dealershipAdminRouter.patch(
  "/commission-rules/:id",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuidSchema.parse(request.params.id);
    const input = commissionUpdateSchema.parse(request.body);
    const updated = await db.transaction(async (tx) => {
      const [existing] = await tx.select({
        id: commissionRules.id,
        effectiveFrom: commissionRules.effectiveFrom,
      }).from(commissionRules)
        .where(and(eq(commissionRules.id, id), eq(commissionRules.workspaceId, workspaceId)))
        .limit(1);
      if (!existing) throw new AppError(404, "COMMISSION_RULE_NOT_FOUND", "Commission rule was not found");
      if (input.effectiveTo && input.effectiveTo <= existing.effectiveFrom) {
        throw new AppError(400, "INVALID_EFFECTIVE_RANGE", "Effective end must be after the start");
      }
      const [rule] = await tx.update(commissionRules).set({ ...input, updatedAt: new Date() })
        .where(eq(commissionRules.id, existing.id)).returning();
      if (!rule) throw new Error("Failed to update commission rule");
      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: request.user!.id,
        action: "commission_rule.updated",
        entityType: "commission_rule",
        entityId: id,
        metadata: { isActive: rule.isActive },
      });
      return rule;
    });
    response.json({ data: updated });
  }),
);

dealershipAdminRouter.get(
  "/audit-events",
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
