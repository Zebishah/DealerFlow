import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { accessRequests, sessions, users } from "../db/schema.js";
import type { UserRole } from "../db/schema.js";
import { AppError } from "../lib/errors.js";

export interface AuthenticatedUser {
  id: string;
  workspaceId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: Date | null;
  isDemoRecruiter: boolean;
}

export type RecruiterPermission =
  | "dealership.leads.write"
  | "dealership.sales.write"
  | "dealership.documents.read"
  | "dealership.documents.upload"
  | "scraping.jobs.trigger"
  | "scraping.jobs.live";

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
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));

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
        mustChangePassword: users.mustChangePassword,
        temporaryPasswordExpiresAt: users.temporaryPasswordExpiresAt,
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
        mustChangePassword: session.mustChangePassword,
        temporaryPasswordExpiresAt: session.temporaryPasswordExpiresAt,
        isDemoRecruiter: session.role === "recruiter" && session.email.toLowerCase() === env.DEMO_RECRUITER_EMAIL.toLowerCase(),
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

const passwordChangeRoutes = new Set([
  "GET /auth/session",
  "GET /auth/capabilities",
  "POST /auth/csrf",
  "POST /auth/change-password",
  "POST /auth/logout",
]);

export function requirePasswordChange(request: Request, _response: Response, next: NextFunction): void {
  if (request.user?.mustChangePassword && !passwordChangeRoutes.has(`${request.method} ${request.path}`)) {
    return next(new AppError(403, "PASSWORD_CHANGE_REQUIRED", "Change your temporary password before using the workspace"));
  }
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

export async function hasRecruiterPermission(userId: string, permission: RecruiterPermission): Promise<boolean> {
  const rows = await db.select({ grantedPermissions: accessRequests.grantedPermissions })
    .from(accessRequests)
    .where(and(
      eq(accessRequests.provisionedUserId, userId),
      eq(accessRequests.status, "approved"),
      gt(accessRequests.approvedUntil, new Date()),
    ));
  return rows.some((row) => row.grantedPermissions.includes(permission));
}

async function recruiterAccessHasExpired(userId: string): Promise<boolean> {
  const rows = await db.select({ approvedUntil: accessRequests.approvedUntil })
    .from(accessRequests)
    .where(and(eq(accessRequests.provisionedUserId, userId), eq(accessRequests.status, "approved")));
  return rows.some((row) => row.approvedUntil !== null && row.approvedUntil <= new Date());
}

export function requirePermission(permission: RecruiterPermission) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      if (!request.user) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
      if (request.user.role !== "recruiter") return next();
      if (request.user.temporaryPasswordExpiresAt && request.user.temporaryPasswordExpiresAt <= new Date()) {
        throw new AppError(403, "TEMPORARY_ACCESS_EXPIRED", "Your temporary access has expired. Request access again.");
      }
      if (!await hasRecruiterPermission(request.user.id, permission)) {
        if (await recruiterAccessHasExpired(request.user.id)) {
          throw new AppError(403, "EVALUATION_ACCESS_EXPIRED", "Your evaluation access has expired. Request an extension.");
        }
        throw new AppError(403, "APPROVED_ACCESS_REQUIRED", "This action requires approved evaluation access.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
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

/**
 * Tenant-facing routes must never silently fall back to platform-wide data.
 * Platform operators are intentionally allowed to work without a workspace;
 * workspace roles are not.
 */
export function requireWorkspaceForRoles(...roles: readonly UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    try {
      if (request.user && roles.includes(request.user.role)) {
        requireWorkspace(request);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
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
