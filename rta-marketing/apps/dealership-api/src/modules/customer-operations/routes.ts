import { and, asc, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireCsrf, requireRoles, requireSession, requireWorkspace } from "../../auth/session.js";
import type { AuthenticatedUser } from "../../auth/session.js";
import { db } from "../../db/client.js";
import {
  appointments,
  auditEvents,
  followUps,
  leadActivities,
  leads,
  operationsMessages,
  operationsThreads,
  users,
} from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";

const uuid = z.string().uuid();
const appointmentStatuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show", "reschedule_requested"] as const;
const followUpStatuses = ["pending", "completed", "snoozed", "cancelled"] as const;
const priorities = ["normal", "high", "urgent"] as const;
const appointmentTypes = ["showroom_visit", "test_drive", "finance_consultation", "delivery", "callback", "other"] as const;
const followUpTypes = ["call", "email", "sms", "customer_callback", "appointment_confirmation", "appointment_follow_up", "post_test_drive", "deal_follow_up", "delivery_follow_up", "post_sale", "post_visit", "general"] as const;
const activityTypes = ["contact", "internal_note", "status_changed", "follow_up", "appointment"] as const;
const contactMethods = ["phone", "email", "sms", "other"] as const;

const appointmentInput = z.object({
  leadId: uuid,
  scheduledAt: z.coerce.date(),
  type: z.enum(appointmentTypes),
  assignedUserId: uuid.nullable().optional(),
  salespersonId: uuid.nullable().optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
});
const appointmentUpdate = appointmentInput.partial().extend({ status: z.enum(appointmentStatuses).optional(), version: z.number().int().min(1) });
const followUpInput = z.object({
  leadId: uuid,
  dueAt: z.coerce.date(),
  type: z.enum(followUpTypes),
  priority: z.enum(priorities).default("normal"),
  assignedToUserId: uuid.nullable().optional(),
  note: z.string().trim().max(2_000).nullable().optional(),
});
const followUpUpdate = followUpInput.partial().extend({ status: z.enum(followUpStatuses).optional(), version: z.number().int().min(1) });
const activityInput = z.object({
  type: z.enum(activityTypes),
  method: z.enum(contactMethods).nullable().optional(),
  note: z.string().trim().min(2).max(2_000),
});
const threadInput = z.object({
  subject: z.string().trim().min(2).max(160),
  leadId: uuid.nullable().optional(),
  assignedToUserId: uuid.nullable().optional(),
  priority: z.enum(priorities).default("normal"),
  body: z.string().trim().min(2).max(4_000),
});
const threadUpdate = z.object({
  assignedToUserId: uuid.nullable().optional(),
  priority: z.enum(priorities).optional(),
  status: z.enum(["open", "waiting", "resolved"] as const).optional(),
  version: z.number().int().min(1),
});
const messageInput = z.object({ body: z.string().trim().min(2).max(4_000) });

function canWrite(user: AuthenticatedUser): boolean {
  return ["admin", "employee", "virtual_assistant"].includes(user.role);
}

function ownOrWorkspace(user: AuthenticatedUser, workspaceId: string, column: typeof followUps.assignedToUserId) {
  return user.role === "admin" || user.role === "recruiter"
    ? eq(followUps.workspaceId, workspaceId)
    : and(eq(followUps.workspaceId, workspaceId), or(eq(column, user.id), eq(followUps.createdByUserId, user.id)));
}

function dayBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

async function assertLead(workspaceId: string, leadId: string, user: AuthenticatedUser) {
  const [lead] = await db.select({ id: leads.id, firstName: leads.firstName, lastName: leads.lastName })
    .from(leads).where(and(eq(leads.id, leadId), eq(leads.workspaceId, workspaceId))).limit(1);
  if (!lead) throw new AppError(404, "LEAD_NOT_FOUND", "Lead was not found in this workspace");
  if (user.role === "employee") {
    const [owned] = await db.select({ id: leads.id }).from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.assignedToUserId, user.id))).limit(1);
    if (!owned) throw new AppError(403, "LEAD_ACCESS_FORBIDDEN", "This lead is not assigned to you");
  }
  return lead;
}

async function assertMember(workspaceId: string, userId: string | null | undefined) {
  if (!userId) return;
  const [member] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, userId), eq(users.workspaceId, workspaceId), eq(users.isActive, true))).limit(1);
  if (!member) throw new AppError(400, "INVALID_ASSIGNEE", "The selected team member is not active in this workspace");
}

export const customerOperationsRouter = Router();
customerOperationsRouter.use(requireSession, requireRoles("admin", "employee", "virtual_assistant", "recruiter"));

customerOperationsRouter.get("/my-day", asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request);
  const user = request.user!;
  const { start, end } = dayBounds();
  const assignment = user.role === "admin" || user.role === "recruiter" ? sql`true` : or(eq(followUps.assignedToUserId, user.id), eq(followUps.createdByUserId, user.id));
  const appointmentAssignment = user.role === "admin" || user.role === "recruiter" ? sql`true` : or(eq(appointments.assignedUserId, user.id), eq(appointments.salespersonId, user.id), eq(appointments.createdByUserId, user.id));
  const threadAssignment = user.role === "admin" || user.role === "recruiter" ? sql`true` : or(eq(operationsThreads.assignedToUserId, user.id), eq(operationsThreads.createdByUserId, user.id));
  const [newLeads, due, overdue, todayAppointments, confirmations, escalations, priority] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.workspaceId, workspaceId), eq(leads.status, "new"), user.role === "employee" ? eq(leads.assignedToUserId, user.id) : sql`true`)),
    db.select({ count: sql<number>`count(*)::int` }).from(followUps).where(and(eq(followUps.workspaceId, workspaceId), eq(followUps.status, "pending"), gte(followUps.dueAt, start), lt(followUps.dueAt, end), assignment)),
    db.select({ count: sql<number>`count(*)::int` }).from(followUps).where(and(eq(followUps.workspaceId, workspaceId), eq(followUps.status, "pending"), lt(followUps.dueAt, new Date()), assignment)),
    db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), sql`${appointments.status} in ('scheduled','confirmed')`, appointmentAssignment)),
    db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), eq(appointments.status, "scheduled"), appointmentAssignment)),
    db.select({ count: sql<number>`count(*)::int` }).from(operationsThreads).where(and(eq(operationsThreads.workspaceId, workspaceId), eq(operationsThreads.status, "open"), threadAssignment)),
    db.select({ id: followUps.id, leadId: leads.id, firstName: leads.firstName, lastName: leads.lastName, status: leads.status, dueAt: followUps.dueAt, priority: followUps.priority, note: followUps.note })
      .from(followUps).innerJoin(leads, eq(followUps.leadId, leads.id))
      .where(and(eq(followUps.workspaceId, workspaceId), eq(followUps.status, "pending"), assignment))
      .orderBy(asc(followUps.dueAt), desc(followUps.priority)).limit(8),
  ]);
  response.json({ data: {
    counts: { newLeads: newLeads[0]?.count ?? 0, dueToday: due[0]?.count ?? 0, overdue: overdue[0]?.count ?? 0, appointmentsToday: todayAppointments[0]?.count ?? 0, confirmations: confirmations[0]?.count ?? 0, escalations: escalations[0]?.count ?? 0 },
    priority,
  } });
}));

customerOperationsRouter.get("/appointments", asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request);
  const user = request.user!;
  const query = z.object({ status: z.enum(appointmentStatuses).optional(), assignedUserId: uuid.optional() }).parse(request.query);
  const scope = user.role === "admin" || user.role === "recruiter" ? sql`true` : or(eq(appointments.assignedUserId, user.id), eq(appointments.salespersonId, user.id), eq(appointments.createdByUserId, user.id));
  const conditions = [eq(appointments.workspaceId, workspaceId), scope];
  if (query.status) conditions.push(eq(appointments.status, query.status));
  if (query.assignedUserId) conditions.push(eq(appointments.assignedUserId, query.assignedUserId));
  const rows = await db.select({ appointment: appointments, leadFirstName: leads.firstName, leadLastName: leads.lastName, assignedFirstName: users.firstName, assignedLastName: users.lastName })
    .from(appointments).innerJoin(leads, eq(appointments.leadId, leads.id)).leftJoin(users, eq(appointments.assignedUserId, users.id))
    .where(and(...conditions)).orderBy(asc(appointments.scheduledAt)).limit(200);
  response.json({ data: rows.map((row) => ({ ...row.appointment, leadName: `${row.leadFirstName} ${row.leadLastName}`, assignedName: [row.assignedFirstName, row.assignedLastName].filter(Boolean).join(" ") || null })) });
}));

customerOperationsRouter.post("/appointments", requireCsrf, asyncHandler(async (request, response) => {
  if (!canWrite(request.user!)) throw new AppError(403, "APPOINTMENT_WRITE_FORBIDDEN", "Your role cannot create appointments");
  const workspaceId = requireWorkspace(request); const input = appointmentInput.parse(request.body);
  const lead = await assertLead(workspaceId, input.leadId, request.user!);
  const assignedUserId = input.assignedUserId ?? (["virtual_assistant", "employee"].includes(request.user!.role) ? request.user!.id : null);
  await assertMember(workspaceId, assignedUserId); await assertMember(workspaceId, input.salespersonId);
  const created = await db.transaction(async (tx) => {
    const [appointment] = await tx.insert(appointments).values({ ...input, workspaceId, assignedUserId, salespersonId: input.salespersonId ?? null, createdByUserId: request.user!.id, type: input.type, status: "scheduled" }).returning();
    if (!appointment) throw new Error("Failed to create appointment");
    await tx.insert(leadActivities).values({ workspaceId, leadId: input.leadId, actorUserId: request.user!.id, type: "appointment", note: `Appointment scheduled for ${appointment.scheduledAt.toISOString()}` });
    await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "appointment.created", entityType: "appointment", entityId: appointment.id, metadata: { leadId: lead.id } });
    return appointment;
  });
  response.status(201).json({ data: created });
}));

customerOperationsRouter.patch("/appointments/:id", requireCsrf, asyncHandler(async (request, response) => {
  if (!canWrite(request.user!)) throw new AppError(403, "APPOINTMENT_WRITE_FORBIDDEN", "Your role cannot update appointments");
  const workspaceId = requireWorkspace(request); const id = uuid.parse(request.params.id); const { version, ...changes } = appointmentUpdate.parse(request.body);
  const scope = request.user!.role === "admin" ? sql`true` : or(eq(appointments.assignedUserId, request.user!.id), eq(appointments.salespersonId, request.user!.id), eq(appointments.createdByUserId, request.user!.id));
  const [updated] = await db.update(appointments).set({ ...changes, version: version + 1, updatedAt: new Date() }).where(and(eq(appointments.id, id), eq(appointments.workspaceId, workspaceId), eq(appointments.version, version), scope)).returning();
  if (!updated) throw new AppError(409, "STALE_APPOINTMENT", "This appointment changed; refresh and try again");
  await db.transaction(async (tx) => {
    await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: `appointment.${updated.status}`, entityType: "appointment", entityId: id });
    await tx.insert(leadActivities).values({ workspaceId, leadId: updated.leadId, actorUserId: request.user!.id, type: "appointment", note: `Appointment marked ${updated.status.replaceAll("_", " ")}` });
  });
  response.json({ data: updated });
}));

customerOperationsRouter.get("/follow-ups", asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request); const user = request.user!;
  const query = z.object({ status: z.enum(followUpStatuses).optional(), assignedToUserId: uuid.optional() }).parse(request.query);
  const scope = user.role === "admin" || user.role === "recruiter" ? eq(followUps.workspaceId, workspaceId) : ownOrWorkspace(user, workspaceId, followUps.assignedToUserId);
  const conditions = [scope]; if (query.status) conditions.push(eq(followUps.status, query.status)); if (query.assignedToUserId) conditions.push(eq(followUps.assignedToUserId, query.assignedToUserId));
  const rows = await db.select({ followUp: followUps, leadFirstName: leads.firstName, leadLastName: leads.lastName, assignedFirstName: users.firstName, assignedLastName: users.lastName }).from(followUps).innerJoin(leads, eq(followUps.leadId, leads.id)).leftJoin(users, eq(followUps.assignedToUserId, users.id)).where(and(...conditions)).orderBy(asc(followUps.dueAt)).limit(200);
  response.json({ data: rows.map((row) => ({ ...row.followUp, leadName: `${row.leadFirstName} ${row.leadLastName}`, assignedName: [row.assignedFirstName, row.assignedLastName].filter(Boolean).join(" ") || null })) });
}));

customerOperationsRouter.post("/follow-ups", requireCsrf, asyncHandler(async (request, response) => {
  if (!canWrite(request.user!)) throw new AppError(403, "FOLLOW_UP_WRITE_FORBIDDEN", "Your role cannot create follow-ups");
  const workspaceId = requireWorkspace(request); const input = followUpInput.parse(request.body); await assertLead(workspaceId, input.leadId, request.user!);
  const assignedToUserId = input.assignedToUserId ?? (["virtual_assistant", "employee"].includes(request.user!.role) ? request.user!.id : null); await assertMember(workspaceId, assignedToUserId);
  const [created] = await db.insert(followUps).values({ ...input, workspaceId, assignedToUserId, createdByUserId: request.user!.id, note: input.note ?? null }).returning();
  if (!created) throw new Error("Failed to create follow-up");
  await db.insert(leadActivities).values({ workspaceId, leadId: input.leadId, actorUserId: request.user!.id, type: "follow_up", note: input.note ?? `Follow-up scheduled for ${input.dueAt.toISOString()}` });
  await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "follow_up.created", entityType: "follow_up", entityId: created.id });
  response.status(201).json({ data: created });
}));

customerOperationsRouter.patch("/follow-ups/:id", requireCsrf, asyncHandler(async (request, response) => {
  if (!canWrite(request.user!)) throw new AppError(403, "FOLLOW_UP_WRITE_FORBIDDEN", "Your role cannot update follow-ups");
  const workspaceId = requireWorkspace(request); const id = uuid.parse(request.params.id); const { version, ...changes } = followUpUpdate.parse(request.body);
  const scope = request.user!.role === "admin" ? sql`true` : or(eq(followUps.assignedToUserId, request.user!.id), eq(followUps.createdByUserId, request.user!.id));
  const [updated] = await db.update(followUps).set({ ...changes, completedAt: changes.status === "completed" ? new Date() : changes.status ? null : undefined, version: version + 1, updatedAt: new Date() }).where(and(eq(followUps.id, id), eq(followUps.workspaceId, workspaceId), eq(followUps.version, version), scope)).returning();
  if (!updated) throw new AppError(409, "STALE_FOLLOW_UP", "This follow-up changed; refresh and try again");
  await db.transaction(async (tx) => {
    await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: `follow_up.${updated.status}`, entityType: "follow_up", entityId: id });
    await tx.insert(leadActivities).values({ workspaceId, leadId: updated.leadId, actorUserId: request.user!.id, type: "follow_up", note: `Follow-up marked ${updated.status.replaceAll("_", " ")}` });
  });
  response.json({ data: updated });
}));

customerOperationsRouter.get("/leads/:leadId/activities", asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request); const leadId = uuid.parse(request.params.leadId); await assertLead(workspaceId, leadId, request.user!);
  const rows = await db.select({ activity: leadActivities, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(leadActivities).leftJoin(users, eq(leadActivities.actorUserId, users.id)).where(and(eq(leadActivities.workspaceId, workspaceId), eq(leadActivities.leadId, leadId))).orderBy(desc(leadActivities.createdAt)).limit(100);
  response.json({ data: rows.map((row) => ({ ...row.activity, actorName: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "System" })) });
}));

customerOperationsRouter.post("/leads/:leadId/activities", requireCsrf, asyncHandler(async (request, response) => {
  if (!canWrite(request.user!)) throw new AppError(403, "ACTIVITY_WRITE_FORBIDDEN", "Your role cannot record activity");
  const workspaceId = requireWorkspace(request); const leadId = uuid.parse(request.params.leadId); await assertLead(workspaceId, leadId, request.user!); const input = activityInput.parse(request.body);
  const [created] = await db.insert(leadActivities).values({ ...input, workspaceId, leadId, actorUserId: request.user!.id, method: input.method ?? null }).returning();
  if (!created) throw new Error("Failed to record activity");
  await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "lead.activity_recorded", entityType: "lead", entityId: leadId, metadata: { activityId: created.id, type: created.type } });
  response.status(201).json({ data: created });
}));

customerOperationsRouter.get("/inbox", asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request); const user = request.user!;
  const scope = user.role === "admin" || user.role === "recruiter" ? eq(operationsThreads.workspaceId, workspaceId) : and(eq(operationsThreads.workspaceId, workspaceId), or(eq(operationsThreads.createdByUserId, user.id), eq(operationsThreads.assignedToUserId, user.id)));
  const rows = await db.select({ thread: operationsThreads, leadFirstName: leads.firstName, leadLastName: leads.lastName, creatorFirstName: users.firstName, creatorLastName: users.lastName }).from(operationsThreads).leftJoin(leads, eq(operationsThreads.leadId, leads.id)).leftJoin(users, eq(operationsThreads.createdByUserId, users.id)).where(scope).orderBy(desc(operationsThreads.updatedAt)).limit(100);
  response.json({ data: rows.map((row) => ({ ...row.thread, leadName: row.leadFirstName ? `${row.leadFirstName} ${row.leadLastName}` : null, creatorName: [row.creatorFirstName, row.creatorLastName].filter(Boolean).join(" ") || "Team member" })) });
}));

customerOperationsRouter.get("/inbox/:id", asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request); const id = uuid.parse(request.params.id); const user = request.user!;
  const scope = user.role === "admin" || user.role === "recruiter" ? sql`true` : or(eq(operationsThreads.createdByUserId, user.id), eq(operationsThreads.assignedToUserId, user.id));
  const [thread] = await db.select().from(operationsThreads).where(and(eq(operationsThreads.id, id), eq(operationsThreads.workspaceId, workspaceId), scope)).limit(1);
  if (!thread) throw new AppError(404, "THREAD_NOT_FOUND", "This operations thread was not found");
  const messages = await db.select({ message: operationsMessages, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(operationsMessages).leftJoin(users, eq(operationsMessages.authorUserId, users.id)).where(eq(operationsMessages.threadId, id)).orderBy(asc(operationsMessages.createdAt));
  response.json({ data: { thread, messages: messages.map((row) => ({ ...row.message, authorName: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || "Team member" })) } });
}));

customerOperationsRouter.post("/inbox/:id/accept", requireCsrf, asyncHandler(async (request, response) => {
  if (!canWrite(request.user!)) throw new AppError(403, "THREAD_WRITE_FORBIDDEN", "Your role cannot accept handoffs");
  const workspaceId = requireWorkspace(request); const id = uuid.parse(request.params.id); const user = request.user!;
  const [thread] = await db.select().from(operationsThreads).where(and(eq(operationsThreads.id, id), eq(operationsThreads.workspaceId, workspaceId), eq(operationsThreads.assignedToUserId, user.id))).limit(1);
  if (!thread) throw new AppError(404, "THREAD_NOT_FOUND", "This operations handoff is not assigned to you");
  if (thread.status === "resolved") throw new AppError(409, "THREAD_ALREADY_RESOLVED", "This operations handoff is already resolved");
  const [updated] = await db.update(operationsThreads).set({ status: "waiting", version: thread.version + 1, updatedAt: new Date() }).where(and(eq(operationsThreads.id, id), eq(operationsThreads.version, thread.version))).returning();
  if (!updated) throw new AppError(409, "STALE_THREAD", "This handoff changed; refresh and try again");
  await db.transaction(async (tx) => {
    await tx.insert(auditEvents).values({ workspaceId, actorUserId: user.id, action: "operations_thread.accepted", entityType: "operations_thread", entityId: id });
    if (thread.leadId) await tx.insert(leadActivities).values({ workspaceId, leadId: thread.leadId, actorUserId: user.id, type: "internal_note", note: "Sales handoff accepted" });
  });
  response.json({ data: updated });
}));

customerOperationsRouter.post("/inbox", requireCsrf, asyncHandler(async (request, response) => {
  if (!canWrite(request.user!)) throw new AppError(403, "THREAD_WRITE_FORBIDDEN", "Your role cannot create handoffs");
  const workspaceId = requireWorkspace(request); const { body, ...input } = threadInput.parse(request.body); if (input.leadId) await assertLead(workspaceId, input.leadId, request.user!); await assertMember(workspaceId, input.assignedToUserId);
  const created = await db.transaction(async (tx) => {
    const [thread] = await tx.insert(operationsThreads).values({ ...input, workspaceId, subject: input.subject, leadId: input.leadId ?? null, assignedToUserId: input.assignedToUserId ?? null, createdByUserId: request.user!.id }).returning();
    if (!thread) throw new Error("Failed to create handoff");
    await tx.insert(operationsMessages).values({ threadId: thread.id, authorUserId: request.user!.id, body });
    await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "operations_thread.created", entityType: "operations_thread", entityId: thread.id, metadata: { leadId: input.leadId ?? null } });
    return thread;
  });
  response.status(201).json({ data: created });
}));

customerOperationsRouter.post("/inbox/:id/messages", requireCsrf, asyncHandler(async (request, response) => {
  if (!canWrite(request.user!)) throw new AppError(403, "THREAD_WRITE_FORBIDDEN", "Your role cannot reply to handoffs");
  const workspaceId = requireWorkspace(request); const id = uuid.parse(request.params.id); const input = messageInput.parse(request.body); const user = request.user!;
  const scope = user.role === "admin" ? sql`true` : or(eq(operationsThreads.createdByUserId, user.id), eq(operationsThreads.assignedToUserId, user.id));
  const [thread] = await db.select().from(operationsThreads).where(and(eq(operationsThreads.id, id), eq(operationsThreads.workspaceId, workspaceId), scope)).limit(1); if (!thread) throw new AppError(404, "THREAD_NOT_FOUND", "This operations thread was not found");
  const [message] = await db.insert(operationsMessages).values({ threadId: id, authorUserId: user.id, body: input.body }).returning();
  await db.update(operationsThreads).set({ updatedAt: new Date(), status: thread.status === "resolved" ? "open" : "waiting", version: thread.version + 1 }).where(eq(operationsThreads.id, id));
  if (!message) throw new Error("Failed to add handoff reply");
  await db.transaction(async (tx) => {
    await tx.insert(auditEvents).values({ workspaceId, actorUserId: user.id, action: "operations_thread.replied", entityType: "operations_thread", entityId: id });
    if (thread.leadId) await tx.insert(leadActivities).values({ workspaceId, leadId: thread.leadId, actorUserId: user.id, type: "internal_note", note: "Operations handoff updated" });
  });
  response.status(201).json({ data: message });
}));

customerOperationsRouter.patch("/inbox/:id", requireCsrf, asyncHandler(async (request, response) => {
  if (request.user!.role !== "admin") throw new AppError(403, "THREAD_ADMIN_REQUIRED", "Only admins can assign or resolve operations threads");
  const workspaceId = requireWorkspace(request); const id = uuid.parse(request.params.id); const { version, ...changes } = threadUpdate.parse(request.body); await assertMember(workspaceId, changes.assignedToUserId);
  const [updated] = await db.update(operationsThreads).set({ ...changes, resolvedAt: changes.status === "resolved" ? new Date() : changes.status ? null : undefined, version: version + 1, updatedAt: new Date() }).where(and(eq(operationsThreads.id, id), eq(operationsThreads.workspaceId, workspaceId), eq(operationsThreads.version, version))).returning();
  if (!updated) throw new AppError(409, "STALE_THREAD", "This handoff changed; refresh and try again");
  await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: `operations_thread.${updated.status}`, entityType: "operations_thread", entityId: id });
  response.json({ data: updated });
}));

customerOperationsRouter.get("/performance", asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request); const user = request.user!; const requested = typeof request.query.userId === "string" ? uuid.parse(request.query.userId) : user.id;
  if (["virtual_assistant", "employee"].includes(user.role) && requested !== user.id) throw new AppError(403, "PERFORMANCE_SCOPE_FORBIDDEN", "This role can only view its own performance");
  if (!["admin", "recruiter", "virtual_assistant", "employee"].includes(user.role)) throw new AppError(403, "PERFORMANCE_FORBIDDEN", "This performance view is restricted");
  const assigned = eq(leads.assignedToUserId, requested); const followAssigned = eq(followUps.assignedToUserId, requested); const appointmentAssigned = eq(appointments.assignedUserId, requested);
  const [leadCount, contacted, completedFollowUps, overdue, booked, confirmed, completed, noShows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.workspaceId, workspaceId), assigned)),
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.workspaceId, workspaceId), assigned, sql`${leads.status} <> 'new'`)),
    db.select({ count: sql<number>`count(*)::int` }).from(followUps).where(and(eq(followUps.workspaceId, workspaceId), followAssigned, eq(followUps.status, "completed"))),
    db.select({ count: sql<number>`count(*)::int` }).from(followUps).where(and(eq(followUps.workspaceId, workspaceId), followAssigned, eq(followUps.status, "pending"), lt(followUps.dueAt, new Date()))),
    db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), appointmentAssigned)),
    db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), appointmentAssigned, eq(appointments.status, "confirmed"))),
    db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), appointmentAssigned, eq(appointments.status, "completed"))),
    db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), appointmentAssigned, eq(appointments.status, "no_show"))),
  ]);
  response.json({ data: { userId: requested, leadsAssigned: leadCount[0]?.count ?? 0, leadsContacted: contacted[0]?.count ?? 0, followUpsCompleted: completedFollowUps[0]?.count ?? 0, overdueFollowUps: overdue[0]?.count ?? 0, appointmentsBooked: booked[0]?.count ?? 0, appointmentsConfirmed: confirmed[0]?.count ?? 0, appointmentsCompleted: completed[0]?.count ?? 0, noShows: noShows[0]?.count ?? 0 } });
}));

customerOperationsRouter.get("/admin-overview", requireRoles("admin", "recruiter"), asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request);
  const team = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, role: users.role }).from(users).where(and(eq(users.workspaceId, workspaceId), sql`${users.role} in ('virtual_assistant','employee')`, eq(users.isActive, true))).orderBy(asc(users.firstName));
  const { start, end } = dayBounds();
  const [newLeads, overdue, appointmentsToday, confirmations, openThreads, workloads] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.workspaceId, workspaceId), eq(leads.status, "new"))),
    db.select({ count: sql<number>`count(*)::int` }).from(followUps).where(and(eq(followUps.workspaceId, workspaceId), eq(followUps.status, "pending"), lt(followUps.dueAt, new Date()))),
    db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end), sql`${appointments.status} in ('scheduled','confirmed')`)),
    db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), eq(appointments.status, "scheduled"))),
    db.select({ count: sql<number>`count(*)::int` }).from(operationsThreads).where(and(eq(operationsThreads.workspaceId, workspaceId), eq(operationsThreads.status, "open"))),
    Promise.all(team.map(async (member) => {
      const [assigned, pending, late, today, handoffs] = await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(leads).where(and(eq(leads.workspaceId, workspaceId), eq(leads.assignedToUserId, member.id))),
        db.select({ count: sql<number>`count(*)::int` }).from(followUps).where(and(eq(followUps.workspaceId, workspaceId), eq(followUps.assignedToUserId, member.id), eq(followUps.status, "pending"))),
        db.select({ count: sql<number>`count(*)::int` }).from(followUps).where(and(eq(followUps.workspaceId, workspaceId), eq(followUps.assignedToUserId, member.id), eq(followUps.status, "pending"), lt(followUps.dueAt, new Date()))),
        db.select({ count: sql<number>`count(*)::int` }).from(appointments).where(and(eq(appointments.workspaceId, workspaceId), eq(appointments.assignedUserId, member.id), gte(appointments.scheduledAt, start), lt(appointments.scheduledAt, end))),
        db.select({ count: sql<number>`count(*)::int` }).from(operationsThreads).where(and(eq(operationsThreads.workspaceId, workspaceId), eq(operationsThreads.assignedToUserId, member.id), eq(operationsThreads.status, "open"))),
      ]);
      return { ...member, name: [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email, assignedLeads: assigned[0]?.count ?? 0, pendingFollowUps: pending[0]?.count ?? 0, overdue: late[0]?.count ?? 0, appointmentsToday: today[0]?.count ?? 0, openHandoffs: handoffs[0]?.count ?? 0 };
    })),
  ]);
  response.json({ data: { totals: { activeVAs: team.filter((member) => member.role === "virtual_assistant").length, activeEmployees: team.filter((member) => member.role === "employee").length, activeTeamMembers: team.length, newLeads: newLeads[0]?.count ?? 0, overdueFollowUps: overdue[0]?.count ?? 0, appointmentsToday: appointmentsToday[0]?.count ?? 0, confirmations: confirmations[0]?.count ?? 0, openThreads: openThreads[0]?.count ?? 0 }, workloads } });
}));

customerOperationsRouter.get("/notifications", asyncHandler(async (request, response) => {
  const workspaceId = requireWorkspace(request); const user = request.user!; const now = new Date();
  const workspaceScope = user.role === "admin" || user.role === "recruiter" ? eq(followUps.workspaceId, workspaceId) : and(eq(followUps.workspaceId, workspaceId), eq(followUps.assignedToUserId, user.id));
  const appointmentScope = user.role === "admin" || user.role === "recruiter" ? eq(appointments.workspaceId, workspaceId) : and(eq(appointments.workspaceId, workspaceId), or(eq(appointments.assignedUserId, user.id), eq(appointments.salespersonId, user.id)));
  const threadScope = user.role === "admin" || user.role === "recruiter" ? eq(operationsThreads.workspaceId, workspaceId) : and(eq(operationsThreads.workspaceId, workspaceId), eq(operationsThreads.assignedToUserId, user.id));
  const [follow, appointmentsDue, threads] = await Promise.all([
    db.select({ id: followUps.id, leadId: followUps.leadId, dueAt: followUps.dueAt, note: followUps.note }).from(followUps).where(and(workspaceScope, eq(followUps.status, "pending"), lt(followUps.dueAt, now))).orderBy(asc(followUps.dueAt)).limit(10),
    db.select({ id: appointments.id, leadId: appointments.leadId, scheduledAt: appointments.scheduledAt }).from(appointments).where(and(appointmentScope, eq(appointments.status, "scheduled"))).orderBy(asc(appointments.scheduledAt)).limit(10),
    db.select({ id: operationsThreads.id, subject: operationsThreads.subject, priority: operationsThreads.priority }).from(operationsThreads).where(and(threadScope, eq(operationsThreads.status, "open"))).orderBy(desc(operationsThreads.updatedAt)).limit(10),
  ]);
  const items = [...follow.map((row) => ({ id: `follow-up:${row.id}`, type: "follow_up", title: "Follow-up overdue", body: row.note ?? "A customer follow-up needs attention", href: "/app/follow-ups", createdAt: row.dueAt })), ...appointmentsDue.map((row) => ({ id: `appointment:${row.id}`, type: "appointment", title: "Appointment needs confirmation", body: `Scheduled for ${row.scheduledAt.toISOString()}`, href: "/app/appointments", createdAt: row.scheduledAt })), ...threads.map((row) => ({ id: `thread:${row.id}`, type: "handoff", title: row.priority === "urgent" ? "Urgent handoff" : "New operations handoff", body: row.subject, href: "/app/inbox", createdAt: now }))];
  response.json({ data: { unreadCount: items.length, items } });
}));
