import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { createOpaqueToken, hashOpaqueToken, RESET_TOKEN_TTL_MINUTES, splitFullName, tokenExpiry, VERIFICATION_TOKEN_TTL_MINUTES } from "./tokens.js";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { auditEvents, sessions, users, workspaces } from "../db/schema.js";
import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { addressEmail, sendEmailSafely } from "../services/email/email.service.js";
import { verificationEmail, passwordResetEmail } from "../services/email/templates.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession, requireCsrf, requireSession, rotateCsrfToken, sessionCookieOptions } from "./session.js";
import { createRateLimiter } from "../infra/rate-limit.js";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
});

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(14).max(200),
  confirmPassword: z.string().min(14).max(200),
}).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

const emailSchema = z.object({ email: z.string().trim().email().max(254) });

const demoRoleSchema = z.object({
  role: z.enum(["recruiter", "employee", "virtual_assistant"]).default("recruiter"),
});

const tokenSchema = z.object({ token: z.string().min(40).max(200) });

const resetSchema = z.object({
  token: z.string().min(40).max(200),
  password: z.string().min(14).max(200),
  confirmPassword: z.string().min(14).max(200),
}).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(8).max(200),
  newPassword: z.string().min(14).max(200),
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ["newPassword"],
  message: "New password must differ from the current password",
});

async function findUser(email: string) {
  const rows = await db
    .select({
      id: users.id,
      workspaceId: users.workspaceId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      passwordHash: users.passwordHash,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      temporaryPasswordExpiresAt: users.temporaryPasswordExpiresAt,
      emailVerifiedAt: users.emailVerifiedAt,
      emailVerificationTokenHash: users.emailVerificationTokenHash,
      emailVerificationExpiresAt: users.emailVerificationExpiresAt,
      emailVerificationSentAt: users.emailVerificationSentAt,
      passwordResetTokenHash: users.passwordResetTokenHash,
      passwordResetExpiresAt: users.passwordResetExpiresAt,
      accessInviteTokenHash: users.accessInviteTokenHash,
      accessInviteExpiresAt: users.accessInviteExpiresAt,
    })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);
  return rows[0];
}

async function loginUser(user: Awaited<ReturnType<typeof findUser>>, password: string) {
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }
  if (user.mustChangePassword && user.temporaryPasswordExpiresAt && user.temporaryPasswordExpiresAt <= new Date()) {
    throw new AppError(401, "TEMPORARY_ACCESS_EXPIRED", "Your temporary access has expired. Request access again.");
  }
  if (!user.emailVerifiedAt) {
    throw new AppError(403, "EMAIL_VERIFICATION_REQUIRED", "Your email address has not been verified.");
  }
  const session = await createSession(user.id);
  return { user, session };
}

function authResponse(response: Response, user: NonNullable<Awaited<ReturnType<typeof findUser>>>, session: Awaited<ReturnType<typeof createSession>>) {
  response.cookie(env.SESSION_COOKIE_NAME, session.token, sessionCookieOptions());
  response.status(200).json({
    data: {
      user: {
        id: user.id,
        workspaceId: user.workspaceId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        temporaryPasswordExpiresAt: user.temporaryPasswordExpiresAt,
        emailVerifiedAt: user.emailVerifiedAt,
        isDemoRecruiter: user.role === "recruiter" && user.email.toLowerCase() === env.DEMO_RECRUITER_EMAIL.toLowerCase(),
      },
      csrfToken: session.csrfToken,
    },
  });
}

const signupLimiter = createRateLimiter({ namespace: "auth:signup", windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false });
const verificationLimiter = createRateLimiter({ namespace: "auth:verification", windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false });
const passwordResetLimiter = createRateLimiter({ namespace: "auth:password-reset", windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false });

function publicUrl(path: string): string {
  return `${(env.DEALERSHIP_WEB_URL ?? env.PUBLIC_APP_URL).replace(/\/$/, "")}${path}`;
}

function displayName(user: { firstName: string | null; lastName: string | null; email: string }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

async function sendVerification(user: NonNullable<Awaited<ReturnType<typeof findUser>>>, useCase: "verify_email" | "resend_verification"): Promise<boolean> {
  const rawToken = createOpaqueToken();
  const expiresAt = tokenExpiry(VERIFICATION_TOKEN_TTL_MINUTES);
  await db.update(users).set({ emailVerificationTokenHash: hashOpaqueToken(rawToken), emailVerificationExpiresAt: expiresAt, emailVerificationSentAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
  return sendEmailSafely(addressEmail(verificationEmail(displayName(user), publicUrl(`/verify-email?token=${encodeURIComponent(rawToken)}`), VERIFICATION_TOKEN_TTL_MINUTES, useCase), { email: user.email, name: displayName(user) }), useCase);
}

export const authRouter = Router();

authRouter.post(
  "/signup",
  signupLimiter,
  asyncHandler(async (request, response) => {
    const input = signupSchema.parse(request.body);
    const email = input.email.toLowerCase();
    const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existing) throw new AppError(409, "EMAIL_IN_USE", "An account with this email already exists");
    const { firstName, lastName } = splitFullName(input.fullName);
    const rawToken = createOpaqueToken();
    const verificationExpiresAt = tokenExpiry(VERIFICATION_TOKEN_TTL_MINUTES);
    const created = await db.transaction(async (tx) => {
      const [workspace] = await tx.insert(workspaces).values({ slug: `rta-${randomUUID()}`, name: `${firstName}'s RTA workspace`, mode: "demo" }).returning({ id: workspaces.id });
      if (!workspace) throw new Error("Failed to create workspace");
      const [user] = await tx.insert(users).values({
        workspaceId: workspace.id,
        email,
        passwordHash: hashPassword(input.password),
        firstName,
        lastName,
        role: "viewer",
        emailVerificationTokenHash: hashOpaqueToken(rawToken),
        emailVerificationExpiresAt: verificationExpiresAt,
        emailVerificationSentAt: new Date(),
      }).returning({ id: users.id, workspaceId: users.workspaceId, email: users.email });
      if (!user) throw new Error("Failed to create account");
      await tx.insert(auditEvents).values({ workspaceId: workspace.id, actorUserId: user.id, action: "user.signup", entityType: "user", entityId: user.id });
      return { ...user, firstName, lastName };
    });
    const delivered = await sendEmailSafely(addressEmail(verificationEmail(input.fullName, publicUrl(`/verify-email?token=${encodeURIComponent(rawToken)}`), VERIFICATION_TOKEN_TTL_MINUTES), { email, name: input.fullName }), "verify_email");
    response.status(202).json({ data: { email: created.email, verificationRequired: true, emailDelivery: delivered ? "sent" : "pending" } });
  }),
);

authRouter.post(
  "/resend-verification",
  verificationLimiter,
  asyncHandler(async (request, response) => {
    const { email } = emailSchema.parse(request.body);
    const user = await findUser(email.toLowerCase());
    if (user && !user.emailVerifiedAt) {
      const withinCooldown = user.emailVerificationSentAt && user.emailVerificationSentAt.getTime() > Date.now() - 60_000;
      if (!withinCooldown) await sendVerification(user, "resend_verification");
    }
    response.status(202).json({ data: { message: "If the account exists and still needs verification, a new email will be sent." } });
  }),
);

authRouter.get(
  "/verify-email",
  asyncHandler(async (request, response) => {
    const { token } = tokenSchema.parse(request.query);
    const tokenHash = hashOpaqueToken(token);
    const [user] = await db.select({ id: users.id, workspaceId: users.workspaceId, emailVerifiedAt: users.emailVerifiedAt, expiresAt: users.emailVerificationExpiresAt }).from(users).where(eq(users.emailVerificationTokenHash, tokenHash)).limit(1);
    if (!user) throw new AppError(400, "INVALID_VERIFICATION_TOKEN", "This verification link is invalid or has already been used.");
    if (!user.expiresAt || user.expiresAt <= new Date()) {
      await db.update(users).set({ emailVerificationTokenHash: null, emailVerificationExpiresAt: null, updatedAt: new Date() }).where(eq(users.id, user.id));
      throw new AppError(410, "VERIFICATION_TOKEN_EXPIRED", "This verification link has expired. Request a new one.");
    }
    if (user.emailVerifiedAt) return response.json({ data: { status: "already_verified" } });
    await db.transaction(async (tx) => {
      await tx.update(users).set({ emailVerifiedAt: new Date(), emailVerificationTokenHash: null, emailVerificationExpiresAt: null, emailVerificationSentAt: null, updatedAt: new Date() }).where(and(eq(users.id, user.id), eq(users.emailVerificationTokenHash, tokenHash)));
      if (user.workspaceId) await tx.insert(auditEvents).values({ workspaceId: user.workspaceId, actorUserId: user.id, action: "user.email_verified", entityType: "user", entityId: user.id });
    });
    response.json({ data: { status: "verified" } });
  }),
);

authRouter.post(
  "/forgot-password",
  passwordResetLimiter,
  asyncHandler(async (request, response) => {
    const { email } = emailSchema.parse(request.body);
    const user = await findUser(email.toLowerCase());
    if (user?.emailVerifiedAt) {
      const rawToken = createOpaqueToken();
      const expiresAt = tokenExpiry(RESET_TOKEN_TTL_MINUTES);
      await db.update(users).set({ passwordResetTokenHash: hashOpaqueToken(rawToken), passwordResetExpiresAt: expiresAt, updatedAt: new Date() }).where(eq(users.id, user.id));
      await sendEmailSafely(addressEmail(passwordResetEmail(displayName(user), publicUrl(`/reset-password?token=${encodeURIComponent(rawToken)}`), RESET_TOKEN_TTL_MINUTES), { email: user.email, name: displayName(user) }), "password_reset");
    }
    response.status(202).json({ data: { message: "If an account exists for that email address, we've sent password reset instructions." } });
  }),
);

authRouter.post(
  "/reset-password",
  passwordResetLimiter,
  asyncHandler(async (request, response) => {
    const input = resetSchema.parse(request.body);
    const tokenHash = hashOpaqueToken(input.token);
    const [user] = await db.select({ id: users.id, workspaceId: users.workspaceId, tokenHash: users.passwordResetTokenHash, expiresAt: users.passwordResetExpiresAt }).from(users).where(eq(users.passwordResetTokenHash, tokenHash)).limit(1);
    if (!user || !user.expiresAt || user.expiresAt <= new Date()) {
      throw new AppError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or has expired.");
    }
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(users).set({ passwordHash: hashPassword(input.password), passwordResetTokenHash: null, passwordResetExpiresAt: null, mustChangePassword: false, temporaryPasswordExpiresAt: null, updatedAt: new Date() }).where(and(eq(users.id, user.id), eq(users.passwordResetTokenHash, tokenHash))).returning({ id: users.id });
      if (!updated) throw new AppError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or has expired.");
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
      if (user.workspaceId) await tx.insert(auditEvents).values({ workspaceId: user.workspaceId, actorUserId: user.id, action: "user.password_reset_completed", entityType: "user", entityId: user.id });
    });
    response.json({ data: { status: "password_reset" } });
  }),
);

authRouter.post(
  "/setup-access",
  asyncHandler(async (request, response) => {
    const input = resetSchema.parse(request.body);
    const tokenHash = hashOpaqueToken(input.token);
    const [user] = await db.select({ id: users.id, workspaceId: users.workspaceId, tokenHash: users.accessInviteTokenHash, expiresAt: users.accessInviteExpiresAt }).from(users).where(eq(users.accessInviteTokenHash, tokenHash)).limit(1);
    if (!user || !user.expiresAt || user.expiresAt <= new Date()) throw new AppError(400, "INVALID_ACCESS_INVITE", "This access invitation is invalid or has expired.");
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(users).set({ passwordHash: hashPassword(input.password), emailVerifiedAt: new Date(), accessInviteTokenHash: null, accessInviteExpiresAt: null, mustChangePassword: false, updatedAt: new Date() }).where(and(eq(users.id, user.id), eq(users.accessInviteTokenHash, tokenHash))).returning({ id: users.id });
      if (!updated) throw new AppError(400, "INVALID_ACCESS_INVITE", "This access invitation is invalid or has expired.");
      if (user.workspaceId) await tx.insert(auditEvents).values({ workspaceId: user.workspaceId, actorUserId: user.id, action: "access.invitation_accepted", entityType: "user", entityId: user.id });
    });
    response.json({ data: { status: "password_set" } });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const credentials = loginSchema.parse(request.body);
    const { user, session } = await loginUser(await findUser(credentials.email), credentials.password);
    authResponse(response, user, session);
  }),
);

authRouter.post(
  "/demo-login",
  asyncHandler(async (request, response) => {
    if (!env.DEMO_MODE || !env.DEMO_RECRUITER_PASSWORD) {
      throw new AppError(503, "DEMO_LOGIN_UNAVAILABLE", "Recruiter demo access is not configured");
    }
    const { role } = demoRoleSchema.parse(request.body ?? {});
    const email = role === "recruiter"
      ? env.DEMO_RECRUITER_EMAIL
      : role === "employee"
        ? "sales@rta.demo"
        : "assistant@rta.demo";
    const user = await findUser(email);
    if (!user || user.role !== role) {
      throw new AppError(503, "DEMO_LOGIN_UNAVAILABLE", "Recruiter demo account is not configured");
    }
    const result = await loginUser(user, env.DEMO_RECRUITER_PASSWORD);
    authResponse(response, result.user, result.session);
  }),
);

authRouter.get(
  "/session",
  requireSession,
  asyncHandler(async (request, response) => {
    const csrfToken = await rotateCsrfToken(request.sessionId!);
    response.json({ data: { user: request.user, csrfToken } });
  }),
);

authRouter.post(
  "/csrf",
  requireSession,
  asyncHandler(async (request, response) => {
    const csrfToken = await rotateCsrfToken(request.sessionId!);
    response.json({ data: { csrfToken } });
  }),
);

authRouter.get("/capabilities", (_request, response) => {
  response.json({
    data: {
      demoMode: env.DEMO_MODE,
      liveScrapingAllowed: env.ALLOW_LIVE_SCRAPING,
      defaultScrapeMode: env.DEFAULT_SCRAPE_MODE,
      recruiterDemoAvailable: env.DEMO_MODE && Boolean(env.DEMO_RECRUITER_PASSWORD),
    },
  });
});


authRouter.patch(
  "/profile",
  requireSession,
  requireCsrf,
  asyncHandler(async (request, response) => {
    const input = profileSchema.parse(request.body);
    const [updated] = await db.update(users).set({
      firstName: input.firstName,
      lastName: input.lastName,
      updatedAt: new Date(),
    }).where(eq(users.id, request.user!.id)).returning({
      id: users.id,
      workspaceId: users.workspaceId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
    });
    if (!updated) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
    if (updated.workspaceId) {
      await db.insert(auditEvents).values({
        workspaceId: updated.workspaceId,
        actorUserId: updated.id,
        action: "profile.updated",
        entityType: "user",
        entityId: updated.id,
      });
    }
    response.json({ data: updated });
  }),
);

authRouter.post(
  "/change-password",
  requireSession,
  requireCsrf,
  asyncHandler(async (request, response) => {
    const input = passwordChangeSchema.parse(request.body);
    const [account] = await db.select({
      id: users.id,
      workspaceId: users.workspaceId,
      passwordHash: users.passwordHash,
    }).from(users).where(eq(users.id, request.user!.id)).limit(1);
    if (!account || !verifyPassword(input.currentPassword, account.passwordHash)) {
      throw new AppError(400, "CURRENT_PASSWORD_INVALID", "Current password is incorrect");
    }
    const passwordHash = await hashPassword(input.newPassword);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash, mustChangePassword: false, temporaryPasswordExpiresAt: null, updatedAt: new Date() }).where(eq(users.id, account.id));
      await tx.delete(sessions).where(and(eq(sessions.userId, account.id), ne(sessions.id, request.sessionId!)));
      if (account.workspaceId) {
        await tx.insert(auditEvents).values({
          workspaceId: account.workspaceId,
          actorUserId: account.id,
          action: "password.changed",
          entityType: "user",
          entityId: account.id,
        });
      }
    });
    response.status(204).send();
  }),
);

authRouter.post(
  "/logout",
  requireSession,
  requireCsrf,
  asyncHandler(async (request, response) => {
    await db.delete(sessions).where(eq(sessions.id, request.sessionId!));
    response.clearCookie(env.SESSION_COOKIE_NAME, sessionCookieOptions());
    response.status(204).send();
  }),
);
