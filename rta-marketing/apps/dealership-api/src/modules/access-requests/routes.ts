import { and, desc, eq, gt, sql } from "drizzle-orm";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { createOpaqueToken, hashOpaqueToken, hoursFromNow, splitFullName, ACCESS_INVITE_TOKEN_TTL_HOURS } from "../../auth/tokens.js";
import { hashPassword } from "../../auth/password.js";
import { env } from "../../config/env.js";
import { requireCsrf, requireWorkspace } from "../../auth/session.js";
import { db } from "../../db/client.js";
import { accessRequests, auditEvents, sessions, users } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import { addressEmail, sendEmailSafely } from "../../services/email/email.service.js";
import { accessApprovedEmail, accessDecisionEmail, accessRequestAdminEmail, accessRequestReceivedEmail } from "../../services/email/templates.js";

const platformSchema = z.enum(["dealership", "scraping"]);
const permissionSchema = z.enum([
  "view",
  "create",
  "edit",
  "upload_documents",
  "run_scrape",
  "admin_evaluation",
  "other",
]);
const durationSchema = z.enum(["24_hours", "3_days", "7_days", "custom"]);

const requestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  company: z.string().trim().min(2).max(160),
  jobTitle: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  linkedInUrl: z.string().trim().url().max(500).refine((value) => /^https?:\/\//i.test(value), "LinkedIn URL must use HTTP or HTTPS").optional().or(z.literal("")),
  reason: z.string().trim().min(20).max(2_000),
  platformScope: z.array(platformSchema).min(1).max(2),
  requestedPermissions: z.array(permissionSchema).min(1).max(7),
  requestedDuration: durationSchema,
  message: z.string().trim().max(2_000).optional(),
}).strict();

const reviewSchema = z.object({
  action: z.enum(["approve", "reject", "revoke", "extend"]),
  grantedPermissions: z.array(z.string().max(80)).max(20).optional(),
  duration: z.enum(["24_hours", "3_days", "7_days"]).optional(),
  notes: z.string().trim().max(2_000).optional(),
}).strict();

const permissionMap: Record<string, string> = {
  create: "dealership.leads.write",
  edit: "dealership.leads.write",
  upload_documents: "dealership.documents.upload",
  run_scrape: "scraping.jobs.trigger",
};

function expiryFor(duration: "24_hours" | "3_days" | "7_days"): Date {
  const hours = duration === "24_hours" ? 24 : duration === "3_days" ? 72 : 168;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function platformUrl(path: string): string {
  return `${(env.DEALERSHIP_WEB_URL ?? env.PUBLIC_APP_URL).replace(/\/$/, "")}${path}`;
}

function durationLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function accessName(firstName: string | null, lastName: string | null, fallback: string): string {
  return [firstName, lastName].filter(Boolean).join(" ") || fallback;
}

export const publicAccessRequestRouter = Router();
publicAccessRequestRouter.post(
  "/",
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: "draft-8", legacyHeaders: false }),
  asyncHandler(async (request, response) => {
    const input = requestSchema.parse(request.body);
    const email = input.email.toLowerCase();
    const [recent] = await db.select({ id: accessRequests.id }).from(accessRequests).where(and(
      sql`lower(${accessRequests.email}) = ${email}`,
      gt(accessRequests.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
      sql`${accessRequests.status} in ('pending', 'approved')`,
    )).limit(1);
    if (recent) throw new AppError(409, "ACCESS_REQUEST_EXISTS", "A recent request for this email is already on file.");
    const [created] = await db.insert(accessRequests).values({
      ...input,
      email,
      linkedInUrl: input.linkedInUrl || null,
      message: input.message || null,
    }).returning({ id: accessRequests.id, createdAt: accessRequests.createdAt });
    if (!created) throw new Error("Failed to create access request");
    const applicantNotified = await sendEmailSafely(addressEmail(accessRequestReceivedEmail(input.fullName), { email, name: input.fullName }), "access_request_received");
    const adminNotified = env.ADMIN_NOTIFICATION_EMAIL
      ? await sendEmailSafely(addressEmail(accessRequestAdminEmail({
        name: input.fullName,
        company: input.company,
        email,
        platformScope: input.platformScope.join(" + "),
        permissions: input.requestedPermissions.join(", "),
        reason: input.reason,
        duration: durationLabel(input.requestedDuration),
        url: platformUrl("/app/access-requests"),
      }), { email: env.ADMIN_NOTIFICATION_EMAIL, name: "RTA access review" }), "access_request_admin")
      : false;
    response.status(201).json({ data: { id: created.id, createdAt: created.createdAt, status: "pending", notifications: { applicant: applicantNotified, admin: adminNotified } } });
  }),
);

export const adminAccessRequestRouter = Router();
adminAccessRequestRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const rows = await db.select().from(accessRequests).orderBy(desc(accessRequests.createdAt)).limit(100);
    const now = new Date();
    response.json({ data: rows.map((row) => row.status === "approved" && row.approvedUntil && row.approvedUntil <= now ? { ...row, status: "expired" as const } : row) });
  }),
);

adminAccessRequestRouter.patch(
  "/:id",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const id = z.string().uuid().parse(request.params.id);
    const input = reviewSchema.parse(request.body);
    const workspaceId = requireWorkspace(request);
    const [current] = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
    if (!current) throw new AppError(404, "ACCESS_REQUEST_NOT_FOUND", "Access request was not found");
    if (input.action === "reject") {
      if (current.status !== "pending") throw new AppError(409, "ACCESS_REQUEST_ALREADY_REVIEWED", "This access request has already been reviewed");
      const [updated] = await db.update(accessRequests).set({ status: "rejected", notes: input.notes ?? null, reviewedAt: new Date(), reviewedByUserId: request.user!.id, updatedAt: new Date() }).where(eq(accessRequests.id, id)).returning();
      await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "access_request.rejected", entityType: "access_request", entityId: id });
      const notified = await sendEmailSafely(addressEmail(accessDecisionEmail("rejected", current.fullName, "Your request was not approved at this time."), { email: current.email, name: current.fullName }), "access_rejected");
      return response.json({ data: { request: updated, notificationSent: notified } });
    }
    if (input.action === "revoke") {
      const updated = await db.transaction(async (tx) => {
        if (current.provisionedUserId) {
          await tx.update(users).set({ isActive: false, updatedAt: new Date() }).where(eq(users.id, current.provisionedUserId));
          await tx.delete(sessions).where(eq(sessions.userId, current.provisionedUserId));
        }
        const result = await tx.update(accessRequests).set({ status: "revoked", notes: input.notes ?? current.notes, reviewedAt: new Date(), reviewedByUserId: request.user!.id, updatedAt: new Date() }).where(eq(accessRequests.id, id)).returning();
        await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "access_request.revoked", entityType: "access_request", entityId: id });
        return result[0];
      });
      const notified = await sendEmailSafely(addressEmail(accessDecisionEmail("revoked", current.fullName, "Your previously approved evaluation access has been revoked."), { email: current.email, name: current.fullName }), "access_revoked");
      return response.json({ data: { request: updated, notificationSent: notified } });
    }
    if (input.action === "extend") {
      if (current.status !== "approved" || !current.provisionedUserId) throw new AppError(409, "ACCESS_REQUEST_NOT_APPROVED", "Only approved access can be extended");
      const approvedUntil = expiryFor(input.duration ?? "7_days");
      const [updated] = await db.update(accessRequests).set({ status: "approved", approvedUntil, notes: input.notes ?? current.notes, updatedAt: new Date() }).where(eq(accessRequests.id, id)).returning();
      await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "access_request.extended", entityType: "access_request", entityId: id, metadata: { approvedUntil } });
      const notified = await sendEmailSafely(addressEmail(accessDecisionEmail("extended", current.fullName, `Your evaluation access has been extended until ${approvedUntil.toISOString()}.`), { email: current.email, name: current.fullName }), "access_extended");
      return response.json({ data: { request: updated, notificationSent: notified } });
    }

    if (current.status !== "pending") throw new AppError(409, "ACCESS_REQUEST_ALREADY_REVIEWED", "This access request has already been reviewed");
    const grantedPermissions = (input.grantedPermissions ?? current.requestedPermissions)
      .flatMap((permission) => permissionMap[permission] ? [permissionMap[permission]] : permission.startsWith("dealership.") || permission.startsWith("scraping.") ? [permission] : []);
    const approvedUntil = expiryFor(input.duration ?? (current.requestedDuration === "3_days" || current.requestedDuration === "7_days" ? current.requestedDuration : "24_hours"));
    const invitationToken = createOpaqueToken();
    const passwordHash = hashPassword(createOpaqueToken());
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: users.id, role: users.role, emailVerifiedAt: users.emailVerifiedAt, firstName: users.firstName, lastName: users.lastName }).from(users).where(sql`lower(${users.email}) = ${current.email.toLowerCase()}`).limit(1);
      let userId = existing?.id;
      const invitationRequired = !existing?.emailVerifiedAt;
      if (existing && !["viewer", "recruiter"].includes(existing.role)) throw new AppError(409, "EMAIL_BELONGS_TO_EXISTING_USER", "This email already belongs to a managed team account");
      if (existing) {
        await tx.update(users).set({ workspaceId, role: "recruiter", isActive: true, emailVerifiedAt: existing.emailVerifiedAt, accessInviteTokenHash: existing.emailVerifiedAt ? null : hashOpaqueToken(invitationToken), accessInviteExpiresAt: existing.emailVerifiedAt ? null : approvedUntil, emailVerificationTokenHash: null, emailVerificationExpiresAt: null, mustChangePassword: false, temporaryPasswordExpiresAt: null, updatedAt: new Date() }).where(eq(users.id, existing.id));
        await tx.delete(sessions).where(eq(sessions.userId, existing.id));
      } else {
        const { firstName, lastName } = splitFullName(current.fullName);
        const [created] = await tx.insert(users).values({ workspaceId, email: current.email.toLowerCase(), passwordHash, firstName, lastName, role: "recruiter", accessInviteTokenHash: hashOpaqueToken(invitationToken), accessInviteExpiresAt: approvedUntil }).returning({ id: users.id });
        if (!created) throw new Error("Failed to create approved recruiter account");
        userId = created.id;
      }
      const [updated] = await tx.update(accessRequests).set({ status: "approved", grantedPermissions, approvedUntil, provisionedUserId: userId, reviewedAt: new Date(), reviewedByUserId: request.user!.id, notes: input.notes ?? null, updatedAt: new Date() }).where(eq(accessRequests.id, id)).returning();
      if (!updated) throw new Error("Failed to update access request");
      await tx.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "access_request.approved", entityType: "access_request", entityId: id, metadata: { provisionedUserId: userId, grantedPermissions, approvedUntil } });
      return { request: updated, invitationRequired };
    });
    const notified = await sendEmailSafely(addressEmail(accessApprovedEmail({
      name: current.fullName,
      permissions: grantedPermissions.join(", "),
      expiresAt: approvedUntil.toISOString(),
      setupUrl: platformUrl(`/setup-access?token=${encodeURIComponent(invitationToken)}`),
      loginUrl: platformUrl("/login"),
      scrapingUrl: env.SCRAPING_WEB_URL ?? platformUrl("/app/acquisition"),
      invitation: result.invitationRequired,
    }), { email: current.email, name: current.fullName }), "access_approved");
    response.json({ data: { request: result.request, invitationSent: notified, notificationFailed: !notified } });
  }),
);

adminAccessRequestRouter.post(
  "/:id/resend-notification",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const id = z.string().uuid().parse(request.params.id);
    const workspaceId = requireWorkspace(request);
    const [current] = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
    if (!current || current.status !== "approved" || !current.provisionedUserId) throw new AppError(409, "ACCESS_REQUEST_NOT_APPROVED", "Only approved access can receive a notification");
    const [user] = await db.select({ email: users.email, firstName: users.firstName, lastName: users.lastName, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, current.provisionedUserId)).limit(1);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "The approved recruiter account was not found");
    const invitationToken = user.emailVerifiedAt ? null : createOpaqueToken();
    if (invitationToken) await db.update(users).set({ accessInviteTokenHash: hashOpaqueToken(invitationToken), accessInviteExpiresAt: current.approvedUntil ?? hoursFromNow(ACCESS_INVITE_TOKEN_TTL_HOURS), updatedAt: new Date() }).where(eq(users.id, current.provisionedUserId));
    const notified = await sendEmailSafely(addressEmail(accessApprovedEmail({
      name: accessName(user.firstName, user.lastName, current.email),
      permissions: current.grantedPermissions.join(", "),
      expiresAt: current.approvedUntil?.toISOString() ?? "the approved window",
      setupUrl: platformUrl(`/setup-access?token=${encodeURIComponent(invitationToken ?? "")}`),
      loginUrl: platformUrl("/login"),
      scrapingUrl: env.SCRAPING_WEB_URL ?? platformUrl("/app/acquisition"),
      invitation: Boolean(invitationToken),
    }), { email: user.email, name: accessName(user.firstName, user.lastName, current.email) }), "access_approved");
    await db.insert(auditEvents).values({ workspaceId, actorUserId: request.user!.id, action: "access_request.notification_resent", entityType: "access_request", entityId: id });
    response.json({ data: { notificationSent: notified } });
  }),
);
