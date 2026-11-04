import { api, ApiError } from "../lib/api";
import type { SessionUser } from "../types/domain";

type SessionData = { user: SessionUser; csrfToken: string };

export async function startSession(path: "/auth/login" | "/auth/demo-login", credentials: Record<string, string>): Promise<SessionData> {
  const created = await api<{ data: SessionData }>(path, { method: "POST", body: JSON.stringify(credentials) });
  try {
    // A successful login response alone does not mean the browser saved its cookie.
    // Verify a credentialed round trip before showing an authenticated workspace.
    const verified = await api<{ data: SessionData }>("/auth/session");
    return { user: { ...created.data.user, ...verified.data.user }, csrfToken: verified.data.csrfToken };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new ApiError(401, "SESSION_NOT_ESTABLISHED", "Your browser could not retain the sign-in session. Reload this page and try signing in again.", error.requestId);
    }
    throw error;
  }
}
