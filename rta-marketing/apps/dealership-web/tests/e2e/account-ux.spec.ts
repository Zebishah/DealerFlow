import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function mockAccount(page: Page, options: { mustChangePassword?: boolean; document?: boolean; role?: "employee" | "admin" } = {}) {
  const fixture = { signedIn: true, logoutCalls: 0, logoutFailures: 0, logoutStatus: 204, deleteCalls: 0, deleteFailures: 0, notificationFailure: false, document: Boolean(options.document), releaseLogout: null as (() => void) | null, holdLogout: false };
  const user = { id: "employee-1", workspaceId: "workspace-1", email: "driver@example.com", firstName: "Alex", lastName: "Driver", role: options.role ?? "employee", mustChangePassword: Boolean(options.mustChangePassword), emailVerifiedAt: "2026-01-01", isDemoRecruiter: false };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) return route.fulfill(fixture.signedIn
      ? { json: { data: { user, csrfToken: "test-csrf" } } }
      : { status: 401, json: { error: { code: "AUTH_REQUIRED", message: "Authentication is required" } } });
    if (path.endsWith("/auth/logout")) {
      fixture.logoutCalls += 1;
      if (fixture.holdLogout) await new Promise<void>((resolve) => { fixture.releaseLogout = resolve; });
      if (fixture.logoutFailures > 0) {
        fixture.logoutFailures -= 1;
        return route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Connection interrupted. Please try again." } } });
      }
      fixture.signedIn = false;
      return route.fulfill(fixture.logoutStatus === 401
        ? { status: 401, json: { error: { code: "AUTH_REQUIRED", message: "Authentication is required" } } }
        : { status: 204 });
    }
    if (path.endsWith("/dealership/bootstrap")) return route.fulfill({ json: { data: { workspace: { id: "workspace-1", name: "RTA Workspace", mode: "live" }, user, team: [{ ...user, isActive: true }], leadSources: [], financeProviders: [] } } });
    if (path.endsWith("/customer-operations/notifications")) return route.fulfill(fixture.notificationFailure
      ? { status: 503, json: { error: { code: "UNAVAILABLE", message: "Notifications unavailable" } } }
      : { json: { data: { unreadCount: 0, items: [] } } });
    if (path.endsWith("/assistant/chat")) return route.fulfill({ json: { data: { answer: "Private workspace conversation", sources: [], suggestions: [], navigation: [] } } });
    if (path.endsWith("/dealership/documents/document-1") && route.request().method() === "DELETE") {
      fixture.deleteCalls += 1;
      if (fixture.deleteFailures > 0) {
        fixture.deleteFailures -= 1;
        return route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Could not delete. Try again." } } });
      }
      fixture.document = false;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/dealership/documents")) return route.fulfill({ json: { data: fixture.document ? [{ id: "document-1", userId: user.id, kind: "insurance", status: "pending", fileName: "insurance-policy.pdf", mimeType: "application/pdf", sizeBytes: 1000, expiresAt: null, createdAt: "2026-11-01", firstName: user.firstName, lastName: user.lastName, email: user.email }] : [] } });
    return route.fulfill({ json: { data: [] } });
  });
  return fixture;
}

async function openLogout(page: Page) {
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  return page.getByRole("alertdialog", { name: "Sign out of Dealer Flow?" });
}

test("logout asks for confirmation, supports cancellation, and keeps keyboard focus in the dialog", async ({ page }) => {
  const fixture = await mockAccount(page);
  await page.goto("/app/settings");
  const dialog = await openLogout(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Stay signed in" })).toBeFocused();
  expect(fixture.logoutCalls).toBe(0);
  await dialog.getByRole("button", { name: "Sign out", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeFocused();
  expect(fixture.logoutCalls).toBe(0);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Account menu" })).toHaveAttribute("aria-expanded", "false");
});

test("confirmed logout blocks duplicates, clears assistant state, and protects the workspace after reload", async ({ page }) => {
  const fixture = await mockAccount(page);
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Open Dealer Flow Assistant" }).click();
  await page.getByLabel("Ask the Dealer Flow assistant").fill("My private workspace question");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("Private workspace conversation")).toBeVisible();
  await page.getByRole("button", { name: "Close assistant", exact: true }).click();
  fixture.holdLogout = true;
  const dialog = await openLogout(page);
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect.poll(() => fixture.logoutCalls).toBe(1);
  await expect(dialog.getByRole("button", { name: "Signing out…" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Stay signed in" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  fixture.releaseLogout?.();
  await expect(page).toHaveURL(/\/login$/);
  expect(fixture.logoutCalls).toBe(1);
  expect(await page.evaluate(() => sessionStorage.getItem("rta-csrf-token"))).toBeNull();
  await page.getByRole("button", { name: "Open Dealer Flow Assistant" }).click();
  await expect(page.getByText("Private workspace conversation")).toHaveCount(0);
  await expect(page.getByText("My private workspace question")).toHaveCount(0);
  await page.goto("/app/settings");
  await expect(page).toHaveURL(/\/login$/);
});

test("logout failures stay actionable and an expired session can still be signed out", async ({ page }) => {
  const fixture = await mockAccount(page);
  fixture.logoutFailures = 1;
  await page.goto("/app/settings");
  const dialog = await openLogout(page);
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Connection interrupted");
  await expect(page).toHaveURL(/\/app\/settings$/);
  await expect(dialog.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled();
  fixture.logoutStatus = 401;
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(fixture.logoutCalls).toBe(2);
});

test("mobile navigation traps focus, closes with Escape, and keeps the layout within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAccount(page);
  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "Your profile and credentials." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const settingsAudit = await new AxeBuilder({ page }).analyze();
  expect(settingsAudit.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const nav = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Close navigation" })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Shift+Tab");
  await expect(nav.getByRole("button", { name: /A clearer next move/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(nav).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  const dialog = await openLogout(page);
  await expect(dialog).toBeVisible();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((item) => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});

test("temporary-password users can safely sign out from the required password dialog", async ({ page }) => {
  await mockAccount(page, { mustChangePassword: true });
  await page.goto("/app/settings");
  const password = page.getByRole("dialog", { name: "Set your private password" });
  await expect(password).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(password).toBeVisible();
  await password.getByRole("button", { name: "Sign out instead" }).click();
  const logout = page.getByRole("alertdialog", { name: "Sign out of Dealer Flow?" });
  await expect(logout).toBeVisible();
  await logout.getByRole("button", { name: "Stay signed in" }).click();
  await expect(password).toBeVisible();
  await password.getByRole("button", { name: "Sign out instead" }).click();
  await logout.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("deleting a document requires confirmation and keeps failed deletions retryable", async ({ page }) => {
  const fixture = await mockAccount(page, { document: true });
  fixture.deleteFailures = 1;
  await page.goto("/app/documents");
  await page.getByRole("button", { name: "Delete insurance-policy.pdf" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete this document?" });
  await expect(dialog.getByText("insurance-policy.pdf")).toBeVisible();
  await dialog.getByRole("button", { name: "Keep document" }).click();
  expect(fixture.deleteCalls).toBe(0);
  await page.getByRole("button", { name: "Delete insurance-policy.pdf" }).click();
  await dialog.getByRole("button", { name: "Delete document" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not delete");
  await dialog.getByRole("button", { name: "Delete document" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("No compliance documents")).toBeVisible();
  expect(fixture.deleteCalls).toBe(2);
});

test("notification errors offer retry instead of claiming the inbox is clear", async ({ page }) => {
  const fixture = await mockAccount(page);
  fixture.notificationFailure = true;
  await page.goto("/app/settings");
  await page.getByRole("button", { name: /customer operations notifications/ }).click();
  const notifications = page.getByRole("region", { name: "Notifications" });
  await expect(notifications.getByRole("alert")).toContainText("couldn’t be loaded");
  await expect(notifications.getByText("You are all caught up.")).toHaveCount(0);
  fixture.notificationFailure = false;
  await notifications.getByRole("button", { name: "Try again" }).click();
  await expect(notifications.getByText("You are all caught up.")).toBeVisible();
  await page.getByRole("heading", { name: "Account settings", exact: true }).click();
  await expect(notifications).not.toBeVisible();
});

test("password recovery stays usable while the initial session request is stalled", async ({ page }) => {
  // Keep a real pending request until the screen has rendered.
  let release!: () => void;
  await page.route("**/api/v1/auth/session", async route => {
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ status: 401, json: { error: { code: "AUTH_REQUIRED", message: "Sign in required" } } });
  });
  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Reset your password." })).toBeVisible();
  release?.();
});

test("admin access review has a named, keyboard-accessible dialog", async ({ page }) => {
  await mockAccount(page, { role: "admin" });
  await page.route("**/dealership/admin/access-requests", route => route.fulfill({ json: { data: [{ id: "request-1", fullName: "New Reviewer", email: "reviewer@example.com", company: "Example", jobTitle: "Recruiter", status: "pending", platformScope: ["dealership"], requestedPermissions: ["view"], grantedPermissions: [], reason: "Review the dealership workflows", requestedDuration: "3_days", createdAt: "2026-11-01" }] } }));
  await page.goto("/app/access-requests");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Approve scoped access" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: "View document metadata" })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeFocused();
});

test("the email confirmation stays accessible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/**", route => route.fulfill({ status: 202, json: { data: {} } }));
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill("driver@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(item => item.impact === "serious" || item.impact === "critical")).toEqual([]);
});
