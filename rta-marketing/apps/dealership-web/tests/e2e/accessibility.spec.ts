import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicInventoryPayload = {
  data: {
    items: [{
      id: 1,
      siteId: 1,
      siteName: "Romans International",
      title: "2024 Ferrari Roma",
      price: "£189,000",
      year: "2024",
      mileage: "3,200 miles",
      city: "London",
      listingUrl: "https://example.com/cars/1",
      thumbnailUrl: null,
      scrapedAt: "2026-09-17T12:00:00.000Z",
    }],
    sources: [{ id: 1, name: "Romans International", siteKey: "romans-international" }],
  },
  page: { limit: 24, offset: 0, total: 1, hasMore: false },
};

test("public inventory supports searching and keeps serious accessibility violations at zero", async ({ page }) => {
  await page.route("**scraping-results/public**", async (route) => {
    await route.fulfill({ json: publicInventoryPayload });
  });

  await page.goto("/inventory");
  await expect(page.getByRole("heading", { name: "Search live listings" })).toBeVisible();
  await expect(page.getByText("2024 Ferrari Roma")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search make, model, keyword or location" }).fill("Ferrari");
  await expect(page.getByRole("link", { name: "Sign in to compare 2024 Ferrari Roma" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
});

test("login page has no serious accessibility violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
});

async function mockVAOperationsPages(page: import("@playwright/test").Page, role: "virtual_assistant" | "employee" = "virtual_assistant") {
  const isEmployee = role === "employee";
  const va = { id: isEmployee ? "employee-1" : "va-1", workspaceId: "demo-workspace", email: isEmployee ? "sales@rta.demo" : "assistant@rta.demo", firstName: isEmployee ? "Maya" : "Priya", lastName: "Shah", role, mustChangePassword: false, temporaryPasswordExpiresAt: null, emailVerifiedAt: "2026-01-01T00:00:00.000Z", isDemoRecruiter: false };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) return route.fulfill({ json: { data: { user: va, csrfToken: "test-csrf" } } });
    if (path.endsWith("/dealership/bootstrap")) return route.fulfill({ json: { data: { workspace: { id: "demo-workspace", name: "RTA Demo Workspace", mode: "demo" }, user: va, team: [va], leadSources: [], financeProviders: [] } } });
    if (path.endsWith("/dealership/summary")) return route.fulfill({ json: { data: { period: "2026-09", leads: { total: 2, new: 1, qualified: 1, converted: 0 }, sales: { total: 0, funded: 0, revenueCents: 0, grossProfitCents: 0, commissionCents: 0 }, target: null, recentLeads: [], recentSales: [] } } });
    if (path.endsWith("/customer-operations/my-day")) return route.fulfill({ json: { data: { counts: { newLeads: 1, dueToday: 1, overdue: 0, appointmentsToday: 0, confirmations: 0, escalations: 0 }, priority: [] } } });
    if (path.endsWith("/customer-operations/notifications")) return route.fulfill({ json: { data: { unreadCount: 0, items: [] } } });
    if (path.endsWith("/customer-operations/performance")) return route.fulfill({ json: { data: { userId: va.id, leadsAssigned: 2, leadsContacted: 1, followUpsCompleted: 1, overdueFollowUps: 0, appointmentsBooked: 1, appointmentsConfirmed: 1, appointmentsCompleted: 0, noShows: 0 } } });
    if (path.endsWith("/customer-operations/appointments") || path.endsWith("/customer-operations/follow-ups") || path.endsWith("/customer-operations/inbox")) return route.fulfill({ json: { data: [] } });
    return route.fulfill({ json: { data: [] } });
  });
}

test.describe("virtual assistant customer-operations accessibility", () => {
  const pages = [
    ["/app/my-day", "My day, clearly prioritized."],
    ["/app/appointments", "Appointments that convert."],
    ["/app/follow-ups", "Follow-ups without dropped threads."],
    ["/app/inbox", "Handoffs that stay visible."],
    ["/app/my-performance", "Measure the work behind the conversion."],
    ["/app/performance-board", "Lead momentum, visible at a glance."],
  ] as const;

  for (const [path, heading] of pages) {
    test(`${path} has no serious or critical axe findings`, async ({ page }) => {
      await mockVAOperationsPages(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
    });
  }
});

test.describe("employee customer-operations accessibility", () => {
  const pages = [
    ["/app/overview", "Your sales desk, clearly prioritized."],
    ["/app/my-day", "My day, clearly prioritized."],
    ["/app/appointments", "Appointments that convert."],
    ["/app/follow-ups", "Follow-ups without dropped threads."],
    ["/app/inbox", "Handoffs that stay visible."],
    ["/app/my-performance", "Measure the work behind the conversion."],
    ["/app/performance-board", "Dealership momentum, visible to the whole team."],
  ] as const;

  for (const [path, heading] of pages) {
    test(`${path} has no serious or critical axe findings`, async ({ page }) => {
      await mockVAOperationsPages(page, "employee");
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
    });
  }
});

test.describe("public account screens on mobile", () => {
  for (const path of ["/", "/signup", "/forgot-password", "/resend-verification", "/verify-email", "/reset-password", "/setup-access", "/request-access"]) {
    test(`${path} fits a narrow viewport and has no serious accessibility findings`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.route("**/api/v1/**", route => route.fulfill(new URL(route.request().url()).pathname.endsWith("/auth/session")
        ? { status: 401, json: { error: { code: "AUTH_REQUIRED", message: "Sign in required" } } }
        : { json: publicInventoryPayload }));
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter(item => item.impact === "serious" || item.impact === "critical")
        .map(item => ({ rule: item.id, elements: item.nodes.map(node => ({ target: node.target, issue: node.failureSummary })) }))).toEqual([]);
    });
  }
});

test("the desktop landing page empty state stays readable and accessible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/v1/**", route => route.fulfill({ json: { data: { items: [], sources: [] }, page: { limit: 24, offset: 0, total: 0, hasMore: false } } }));
  await page.goto("/");
  await expect(page.getByText("No current listings", { exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(item => item.impact === "serious" || item.impact === "critical")
    .map(item => ({ rule: item.id, elements: item.nodes.map(node => ({ target: node.target, issue: node.failureSummary })) }))).toEqual([]);
});
