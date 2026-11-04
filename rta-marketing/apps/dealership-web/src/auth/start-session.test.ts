import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../lib/api";
import { startSession } from "./start-session";

vi.mock("../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../lib/api")>(),
  api: vi.fn(),
}));

const request = vi.mocked(api);
const user = { id: "demo-user", workspaceId: "demo-workspace", role: "recruiter", emailVerifiedAt: "2026-01-01" };
beforeEach(() => request.mockReset());

describe("establishing an authenticated session", () => {
  it("verifies the saved cookie and uses the rotated session CSRF token before entering the workspace", async () => {
    request.mockResolvedValueOnce({ data: { user, csrfToken: "login-csrf" } });
    request.mockResolvedValueOnce({ data: { user: { ...user, firstName: "Verified" }, csrfToken: "session-csrf" } });

    const result = await startSession("/auth/demo-login", { role: "recruiter" });
    expect(request).toHaveBeenNthCalledWith(1, "/auth/demo-login", { method: "POST", body: JSON.stringify({ role: "recruiter" }) });
    expect(request).toHaveBeenNthCalledWith(2, "/auth/session");
    expect(result.csrfToken).toBe("session-csrf");
    expect(result.user).toMatchObject({ firstName: "Verified", emailVerifiedAt: "2026-01-01" });
  });

  it("rejects a successful login whose session cookie was blocked instead of showing an unusable dashboard", async () => {
    request.mockResolvedValueOnce({ data: { user, csrfToken: "login-csrf" } });
    request.mockRejectedValueOnce(new ApiError(401, "AUTH_REQUIRED", "Authentication is required", "request-id"));

    await expect(startSession("/auth/login", { email: "demo@rta.test", password: "test-password" })).rejects.toMatchObject({ status: 401, code: "SESSION_NOT_ESTABLISHED", requestId: "request-id" });
  });

  it("preserves rejected credentials and backend failures without treating them as cookie failures", async () => {
    const credentialsError = new ApiError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    request.mockRejectedValueOnce(credentialsError);
    await expect(startSession("/auth/login", { email: "demo@rta.test", password: "invalid" })).rejects.toBe(credentialsError);
    expect(request).toHaveBeenCalledTimes(1);

    request.mockResolvedValueOnce({ data: { user, csrfToken: "login-csrf" } });
    const serverError = new ApiError(503, "UNAVAILABLE", "Please try again");
    request.mockRejectedValueOnce(serverError);
    await expect(startSession("/auth/demo-login", { role: "recruiter" })).rejects.toBe(serverError);
  });
});
