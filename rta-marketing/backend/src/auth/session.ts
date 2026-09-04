import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import type { UserRole } from "../db/schema.js";
import { AppError } from "../lib/errors.js";

export interface AuthenticatedUser {
  id: string;
  workspaceId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionId?: string;
    }
  }
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);
  const [session] = await db
    .insert(sessions)
    .values({ userId, tokenHash: hashToken(token), csrfHash: hashToken(csrfToken), expiresAt })
    .returning({ id: sessions.id });
  if (!session) throw new Error("Failed to create session");
  return { id: session.id, token, csrfToken, expiresAt };
}

export async function rotateCsrfToken(sessionId: string): Promise<string> {
  const csrfToken = randomBytes(32).toString("base64url");
  await db
    .update(sessions)
    .set({ csrfHash: hashToken(csrfToken), lastSeenAt: new Date() })
    .where(eq(sessions.id, sessionId));
  return csrfToken;
}

export async function optionalSession(request: Request, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    if (!token) return next();

    const rows = await db
      .select({
        sessionId: sessions.id,
        csrfHash: sessions.csrfHash,
        userId: users.id,
        workspaceId: users.workspaceId,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, new Date()),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    const session = rows[0];
    if (session) {
      request.sessionId = session.sessionId;
      request.user = {
        id: session.userId,
        workspaceId: session.workspaceId,
        email: session.email,
        firstName: session.firstName,
        lastName: session.lastName,
        role: session.role,
      };
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireSession(request: Request, _response: Response, next: NextFunction): void {
  if (!request.user) return next(new AppError(401, "AUTH_REQUIRED", "Authentication is required"));
  next();
}

export function requireOperator(request: Request, _response: Response, next: NextFunction): void {
  try { assertOperator(request); next(); } catch (error) { next(error); }
}

export function assertOperator(request: Request): void {
  assertRoles(request, ["admin", "operator"]);
}

export function requireRoles(...roles: readonly UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      assertRoles(request, roles);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function assertRoles(request: Request, roles: readonly UserRole[]): void {
  if (!request.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  }
  if (!roles.includes(request.user.role)) {
    throw new AppError(403, "ROLE_REQUIRED", "Your role cannot perform this action");
  }
}

export function requireWorkspace(request: Request): string {
  if (!request.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  }
  if (!request.user.workspaceId) {
    throw new AppError(403, "WORKSPACE_REQUIRED", "A workspace is required");
  }
  return request.user.workspaceId;
}

export async function requireCsrf(request: Request, _response: Response, next: NextFunction) {
  try {
    await assertCsrf(request);
    next();
  } catch (error) {
    next(error);
  }
}

export async function assertCsrf(request: Request): Promise<void> {
  if (!request.sessionId) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const token = request.header("x-csrf-token");
  if (!token) throw new AppError(403, "CSRF_REQUIRED", "CSRF token is required");
  const rows = await db.select({ csrfHash: sessions.csrfHash }).from(sessions).where(eq(sessions.id, request.sessionId));
  const expected = rows[0]?.csrfHash;
  if (!expected || !safeEqual(hashToken(token), expected)) throw new AppError(403, "CSRF_INVALID", "CSRF token is invalid");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: env.SESSION_COOKIE_SAME_SITE,
    maxAge: env.SESSION_TTL_SECONDS * 1000,
    path: "/",
  } as const;
}
