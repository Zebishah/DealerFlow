import { Router } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { auditEvents, sessions, users } from "../db/schema.js";
import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession, requireCsrf, requireSession, rotateCsrfToken, sessionCookieOptions } from "./session.js";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
});

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

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const credentials = loginSchema.parse(request.body);
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
      })
      .from(users)
      .where(sql`lower(${users.email}) = lower(${credentials.email})`)
      .limit(1);
    const user = rows[0];
    if (!user || !user.isActive || !verifyPassword(credentials.password, user.passwordHash)) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
    }

    const session = await createSession(user.id);
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
        },
        csrfToken: session.csrfToken,
      },
    });
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
      await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, account.id));
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
