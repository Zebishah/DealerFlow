import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "demo-recruiter",
  workspaceId: "demo-workspace",
  email: "recruiter.demo@rta.local",
  firstName: "Demo",
  lastName: "Recruiter",
  role: "recruiter",
  mustChangePassword: false,
  temporaryPasswordExpiresAt: null,
  emailVerifiedAt: "2026-01-01T00:00:00.000Z",
  isDemoRecruiter: true,
};

const listing = {
  id: 101,
  siteId: 1,
  siteName: "Romans International",
  title: "2024 Ferrari Roma",
  price: "£189,000",
  year: "2024",
  mileage: "3,200 miles",
  city: "London",
  listingUrl: "https://www.romansinternational.com/used/cars/ferrari-roma",
  thumbnailUrl: null,
  scrapedAt: "2026-09-19T12:00:00.000Z",
};

const summary = {
  period: "2026-09",
  leads: { total: 6, new: 2, qualified: 2, converted: 1 },
  sales: { total: 4, funded: 2, revenueCents: 8095000, grossProfitCents: 875000, commissionCents: 218750 },
  target: { retailTarget: 8, wholesaleTarget: 2, grossProfitTargetCents: 1200000 },
  recentLeads: [],
  recentSales: [],
};

const analytics = {
  period: "last_6_months",
  monthlySales: [{ month: "2026-09", fundedSales: 2, revenueCents: 8095000, grossProfitCents: 875000 }],
  monthlyLeads: [{ month: "2026-09", total: 6, converted: 1 }],
  leadPipeline: [{ status: "new", count: 2 }, { status: "contacted", count: 1 }, { status: "qualified", count: 2 }, { status: "converted", count: 1 }, { status: "lost", count: 0 }],
  leadSources: [{ source: "Website", count: 4 }, { source: "Referral", count: 2 }],
};

async function mockRecruiterApi(page: Page, role = "recruiter") {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const currentUser = { ...user, role };
    if (path.endsWith("/auth/session")) return route.fulfill({ json: { data: { user: currentUser, csrfToken: "test-csrf" } } });
    if (path.endsWith("/dealership/bootstrap")) return route.fulfill({ json: { data: { workspace: { id: "demo-workspace", name: "RTA Demo Workspace", mode: "demo" }, user: currentUser, team: [currentUser], leadSources: [], financeProviders: [] } } });
    if (path.endsWith("/dealership/summary")) return route.fulfill({ json: { data: summary } });
    if (path.endsWith("/dealership/analytics")) return route.fulfill({ json: { data: analytics } });
    if (path.endsWith("/saved-vehicles/scraped")) return route.fulfill({ json: { data: [] } });
    if (path.endsWith("/scraping-results/status")) return route.fulfill({ json: { data: { activeJob: null, defaultLimit: 5, maxLimit: 10, serviceStatus: "available" } } });
    if (path.endsWith("/scraping-results")) return route.fulfill({ json: { data: { items: [listing], sites: [{ id: 1, name: "Romans International", baseUrl: "https://www.romansinternational.com/used/cars/", itemCount: 1, lastScrapedAt: listing.scrapedAt, siteKey: "romans-international", triggerable: true, executionProvider: "apify" }] }, page: { limit: 48, offset: 0, total: 1, hasMore: false } } });
    if (path.endsWith("/operations/source-health")) return route.fulfill({ json: { data: [{ source: "romans-international", name: "Romans International", status: "healthy", lastSuccessAt: listing.scrapedAt, lastFailureAt: null, consecutiveFailures: 0, lastDurationMs: 12000, recordsDiscovered: null, recordsAccepted: 1, recordsRejected: null, parserVersion: "romans-international:v3" }] } });
    if (path.endsWith("/operations/health")) return route.fulfill({ json: { data: { status: "healthy", database: { reachable: true, latencyMs: 18 }, redis: { configured: true, reachable: true, cacheHitRate: 0.75 }, apify: { runs24h: 3, successful: 3, failed: 0, averageDurationMs: 12000 }, ai: { requests24h: 4, providerFailures: 0, fallbacks: 0 } } } });
    return route.fulfill({ json: { data: [] } });
  });
}

async function mockEmployeeApi(page: Page) {
  const employee = { ...user, id: "employee-1", email: "sales@rta.demo", firstName: "Sales", lastName: "Consultant", role: "employee", isDemoRecruiter: false };
  const thread = { id: "thread-1", workspaceId: "demo-workspace", subject: "trade_in_review: Ethan Brown needs appraisal", leadId: "lead-1", createdByUserId: "va-1", assignedToUserId: employee.id, priority: "high", status: "open", resolvedAt: null, version: 1, leadName: "Ethan Brown", creatorName: "Priya Shah" };
  let accepted = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) return route.fulfill({ json: { data: { user: employee, csrfToken: "test-csrf" } } });
    if (path.endsWith("/dealership/bootstrap")) return route.fulfill({ json: { data: { workspace: { id: "demo-workspace", name: "RTA Demo Workspace", mode: "demo" }, user: employee, team: [employee, { id: "admin-1", firstName: "Sales", lastName: "Manager", email: "admin@rta.demo", role: "admin", isActive: true }], leadSources: [], financeProviders: [] } } });
    if (path.endsWith("/dealership/summary")) return route.fulfill({ json: { data: summary } });
    if (path.endsWith("/customer-operations/my-day")) return route.fulfill({ json: { data: { counts: { newLeads: 1, dueToday: 2, overdue: 1, appointmentsToday: 1, confirmations: 0, escalations: 1 }, priority: [] } } });
    if (path.endsWith("/customer-operations/notifications")) return route.fulfill({ json: { data: { unreadCount: 1, items: [{ id: "thread-1", title: "New handoff", body: thread.subject, href: "/app/inbox" }] } } });
    if (path.endsWith("/customer-operations/inbox")) return route.fulfill({ json: { data: [{ ...thread, status: accepted ? "waiting" : "open", version: accepted ? 2 : 1 }] } });
    if (path.endsWith("/customer-operations/inbox/thread-1")) return route.fulfill({ json: { data: { thread: { ...thread, status: accepted ? "waiting" : "open", version: accepted ? 2 : 1 }, messages: [{ id: "message-1", threadId: thread.id, authorUserId: "va-1", body: "Customer wants a trade estimate before the test drive.", createdAt: "2026-09-20T10:00:00.000Z", authorName: "Priya Shah" }] } } });
    if (path.endsWith("/customer-operations/performance")) return route.fulfill({ json: { data: { userId: employee.id, leadsAssigned: 3, leadsContacted: 2, followUpsCompleted: 4, overdueFollowUps: 1, appointmentsBooked: 2, appointmentsConfirmed: 1, appointmentsCompleted: 1, noShows: 0 } } });
    if (path.endsWith("/customer-operations/inbox/thread-1/accept")) { accepted = true; return route.fulfill({ json: { data: { ...thread, status: "waiting", version: 2 } } }); }
    return route.fulfill({ json: { data: [] } });
  });
}

test("recruiter can move from dashboard to analytics and live inventory", async ({ page }) => {
  await mockRecruiterApi(page);
  await page.goto("/app/overview");
  await expect(page.getByRole("heading", { name: "A clear view of team readiness." })).toBeVisible();
  await page.getByRole("link", { name: "Analytics" }).click();
  await expect(page.getByRole("heading", { name: "Performance analytics" }).first()).toBeVisible();
  await expect(page.getByRole("group", { name: /Monthly funded revenue/ })).toBeVisible();
  await page.getByRole("link", { name: "Vehicle intelligence" }).click();
  await expect(page.getByRole("heading", { name: "Search every vehicle collected by the scraper." })).toBeVisible();
  await expect(page.getByText("2024 Ferrari Roma")).toBeVisible();
});

test("inventory search and comparison stay within the authenticated workflow", async ({ page }) => {
  await mockRecruiterApi(page);
  await page.goto("/app/inventory");
  await expect(page.getByRole("heading", { name: "Search every vehicle collected by the scraper." })).toBeVisible();
  await page.getByPlaceholder("Search vehicle or city").fill("Ferrari");
  await expect(page.getByText("2024 Ferrari Roma")).toBeVisible();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByText("1/4 selected")).toBeVisible();
  await page.getByRole("link", { name: "Compare vehicles" }).click();
  await expect(page.getByRole("heading", { name: "Compare scraped vehicles." })).toBeVisible();
  await expect(page.getByText("£189,000")).toBeVisible();
});

test("viewer is redirected away from the admin-only source controls", async ({ page }) => {
  await mockRecruiterApi(page, "viewer");
  await page.goto("/app/source-control");
  await expect(page).toHaveURL(/\/app\/overview$/);
  await expect(page.getByRole("heading", { name: /Your dealership is moving with purpose|A clear view of team readiness/ })).toBeVisible();
});

test("employee sees today operations and can accept a VA handoff", async ({ page }) => {
  await mockEmployeeApi(page);
  await page.goto("/app/overview");
  await expect(page.getByRole("heading", { name: "Your sales desk, clearly prioritized." })).toBeVisible();
  await expect(page.getByText("Appointments today")).toBeVisible();
  await expect(page.getByText("Open handoffs")).toBeVisible();
  await page.getByRole("link", { name: "Operations inbox" }).click();
  await expect(page.getByText("trade_in_review: Ethan Brown needs appraisal")).toBeVisible();
  await page.getByRole("button", { name: /trade_in_review: Ethan Brown/ }).click();
  await expect(page.getByRole("button", { name: "Accept handoff" })).toBeVisible();
  await page.getByRole("button", { name: "Accept handoff" }).click();
  await expect(page.getByText("waiting")).toBeVisible();
});
