import { createHash, randomBytes } from "node:crypto";

export const VERIFICATION_TOKEN_TTL_MINUTES = 45;
export const RESET_TOKEN_TTL_MINUTES = 30;
export const ACCESS_INVITE_TOKEN_TTL_HOURS = 72;

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenExpiry(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60_000);
}

export function splitFullName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? fullName.trim(), lastName: parts.slice(1).join(" ") || null };
}
