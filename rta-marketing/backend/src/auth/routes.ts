import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { asyncHandler } from "../lib/async-handler.js";
import { AppError } from "../lib/errors.js";
import { verifyPassword } from "./password.js";
import { createSession, requireCsrf, requireSession, sessionCookieOptions } from "./session.js";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(200),
});

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const credentials = loginSchema.parse(request.body);
    const rows = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash, role: users.role, isActive: users.isActive })
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
      data: { user: { id: user.id, email: user.email, role: user.role }, csrfToken: session.csrfToken },
    });
  }),
);

authRouter.get("/session", requireSession, (request, response) => {
  response.json({ data: { user: request.user } });
});

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
