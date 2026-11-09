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
  let replied = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) return route.fulfill({ json: { data: { user: employee, csrfToken: "test-csrf" } } });
    if (path.endsWith("/dealership/bootstrap")) return route.fulfill({ json: { data: { workspace: { id: "demo-workspace", name: "RTA Demo Workspace", mode: "demo" }, user: employee, team: [employee, { id: "admin-1", firstName: "Sales", lastName: "Manager", email: "admin@rta.demo", role: "admin", isActive: true }], leadSources: [], financeProviders: [] } } });
    if (path.endsWith("/dealership/summary")) return route.fulfill({ json: { data: summary } });
    if (path.endsWith("/customer-operations/my-day")) return route.fulfill({ json: { data: { counts: { newLeads: 1, dueToday: 2, overdue: 1, appointmentsToday: 1, confirmations: 0, escalations: 1 }, priority: [] } } });
    if (path.endsWith("/customer-operations/notifications")) return route.fulfill({ json: { data: { unreadCount: 1, items: [{ id: "thread-1", title: "New handoff", body: thread.subject, href: "/app/inbox" }] } } });
    if (path.endsWith("/customer-operations/inbox")) return route.fulfill({ json: { data: [{ ...thread, status: accepted ? "waiting" : "open", version: accepted ? 2 : 1 }] } });
    if (path.endsWith("/customer-operations/inbox/thread-1/messages")) { replied = true; return route.fulfill({ status: 201, json: { data: { id: "message-2", threadId: thread.id, authorUserId: employee.id, body: "I have accepted the handoff and will confirm the appointment.", createdAt: "2026-09-20T10:05:00.000Z", authorName: "Sales Consultant" } } }); }
    if (path.endsWith("/customer-operations/inbox/thread-1")) return route.fulfill({ json: { data: { thread: { ...thread, status: accepted ? "waiting" : "open", version: accepted ? 2 : 1 }, messages: [{ id: "message-1", threadId: thread.id, authorUserId: "va-1", body: "Customer wants a trade estimate before the test drive.", createdAt: "2026-09-20T10:00:00.000Z", authorName: "Priya Shah" }, ...(replied ? [{ id: "message-2", threadId: thread.id, authorUserId: employee.id, body: "I have accepted the handoff and will confirm the appointment.", createdAt: "2026-09-20T10:05:00.000Z", authorName: "Sales Consultant" }] : [])] } } });
    if (path.endsWith("/customer-operations/performance")) return route.fulfill({ json: { data: { userId: employee.id, leadsAssigned: 3, leadsContacted: 2, followUpsCompleted: 4, overdueFollowUps: 1, appointmentsBooked: 2, appointmentsConfirmed: 1, appointmentsCompleted: 1, noShows: 0 } } });
    if (path.endsWith("/customer-operations/inbox/thread-1/accept")) { accepted = true; return route.fulfill({ json: { data: { ...thread, status: "waiting", version: 2 } } }); }
    return route.fulfill({ json: { data: [] } });
  });
}

type CustomerOperationsFixture = {
  role: "virtual_assistant" | "employee" | "admin";
  followUpStatus: "pending" | "completed";
  appointments: Array<Record<string, unknown>>;
  handoff: { id: string; workspaceId: string; subject: string; leadId: string | null; createdByUserId: string; assignedToUserId: string | null; priority: string; status: string; resolvedAt: string | null; version: number; leadName: string | null; creatorName: string } | null;
  messages: Array<Record<string, unknown>>;
};

function vaUser(role: CustomerOperationsFixture["role"]) {
  return role === "virtual_assistant"
    ? { id: "va-1", workspaceId: "demo-workspace", email: "assistant@rta.demo", firstName: "Priya", lastName: "Shah", role, mustChangePassword: false, temporaryPasswordExpiresAt: null, emailVerifiedAt: "2026-01-01T00:00:00.000Z", isDemoRecruiter: false }
    : role === "employee"
      ? { id: "employee-1", workspaceId: "demo-workspace", email: "sales@rta.demo", firstName: "Daniel", lastName: "Brooks", role, mustChangePassword: false, temporaryPasswordExpiresAt: null, emailVerifiedAt: "2026-01-01T00:00:00.000Z", isDemoRecruiter: false }
      : { id: "admin-1", workspaceId: "demo-workspace", email: "admin@rta.demo", firstName: "Sales", lastName: "Manager", role, mustChangePassword: false, temporaryPasswordExpiresAt: null, emailVerifiedAt: "2026-01-01T00:00:00.000Z", isDemoRecruiter: false };
}

function createCustomerOperationsFixture(): CustomerOperationsFixture {
  return {
    role: "virtual_assistant",
    followUpStatus: "pending",
    appointments: [],
    handoff: null,
    messages: [],
  };
}

async function mockVAOperationsApi(page: Page, fixture: CustomerOperationsFixture) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const currentUser = vaUser(fixture.role);
    const lead = { id: "lead-1", sourceId: null, assignedToUserId: "va-1", externalReference: "VA-QUALIFIED-1", firstName: "Ethan", lastName: "Brown", email: "ethan@example.com", phone: "+441234567890", vehicleInterest: "2023 Honda CR-V", status: "qualified", notes: "Test-drive interest", version: 1, createdAt: "2026-09-20T08:00:00.000Z", updatedAt: "2026-09-20T08:30:00.000Z" };
    const currentFollowUp = { id: "follow-up-1", workspaceId: "demo-workspace", leadId: lead.id, assignedToUserId: "va-1", createdByUserId: "va-1", dueAt: "2026-09-20T10:00:00.000Z", type: "call", status: fixture.followUpStatus, priority: "high", note: "Confirm test-drive timing", completedAt: fixture.followUpStatus === "completed" ? "2026-09-20T09:30:00.000Z" : null, version: fixture.followUpStatus === "completed" ? 2 : 1, leadName: "Ethan Brown", assignedName: "Priya Shah" };
    const team = [currentUser, { id: "admin-1", firstName: "Sales", lastName: "Manager", email: "admin@rta.demo", role: "admin", isActive: true }, { id: "employee-1", firstName: "Daniel", lastName: "Brooks", email: "daniel@rta.demo", role: "employee", isActive: true }];
    if (path.endsWith("/auth/session")) return route.fulfill({ json: { data: { user: currentUser, csrfToken: "test-csrf" } } });
    if (path.endsWith("/dealership/bootstrap")) return route.fulfill({ json: { data: { workspace: { id: "demo-workspace", name: "RTA Demo Workspace", mode: "demo" }, user: currentUser, team, leadSources: [], financeProviders: [] } } });
    if (path.includes("/dealership/leads")) return route.fulfill({ json: { data: [lead] } });
    if (path.endsWith("/dealership/summary")) return route.fulfill({ json: { data: summary } });
    if (path.endsWith("/customer-operations/notifications")) return route.fulfill({ json: { data: { unreadCount: 0, items: [] } } });
    if (path.endsWith("/customer-operations/my-day")) return route.fulfill({ json: { data: { counts: { newLeads: 1, dueToday: fixture.followUpStatus === "pending" ? 1 : 0, overdue: 0, appointmentsToday: fixture.appointments.length, confirmations: 0, escalations: fixture.handoff?.status === "open" ? 1 : 0 }, priority: fixture.followUpStatus === "pending" ? [{ id: "follow-up-1", leadId: lead.id, firstName: lead.firstName, lastName: lead.lastName, status: "qualified", dueAt: currentFollowUp.dueAt, priority: currentFollowUp.priority, note: currentFollowUp.note }] : [] } } });
    if (path.endsWith("/customer-operations/follow-ups/follow-up-1") && route.request().method() === "PATCH") { fixture.followUpStatus = "completed"; return route.fulfill({ json: { data: { ...currentFollowUp, status: "completed", version: 2, completedAt: "2026-09-20T09:30:00.000Z" } } }); }
    if (path.endsWith("/customer-operations/follow-ups")) return route.fulfill({ json: { data: [currentFollowUp] } });
    if (path.endsWith("/customer-operations/appointments/appointment-1") && route.request().method() === "PATCH") { const body = JSON.parse(route.request().postData() ?? "{}"); const current = fixture.appointments[0]; const appointment = { ...current, status: body.status, version: Number(current?.version ?? 1) + 1 }; fixture.appointments = [appointment]; return route.fulfill({ json: { data: appointment } }); }
    if (path.endsWith("/customer-operations/appointments") && route.request().method() === "POST") { const appointment = { id: "appointment-1", workspaceId: "demo-workspace", leadId: lead.id, assignedUserId: "va-1", salespersonId: null, createdByUserId: "va-1", scheduledAt: "2026-09-21T14:30:00.000Z", type: "test_drive", status: "scheduled", notes: "Bring vehicle history", version: 1, leadName: "Ethan Brown", assignedName: "Priya Shah" }; fixture.appointments = [appointment]; return route.fulfill({ status: 201, json: { data: appointment } }); }
    if (path.endsWith("/customer-operations/appointments")) return route.fulfill({ json: { data: fixture.appointments } });
    if (path.endsWith("/customer-operations/leads/lead-1/activities")) return route.fulfill({ json: { data: [] } });
    if (path.endsWith("/customer-operations/inbox") && route.request().method() === "POST") { const body = JSON.parse(route.request().postData() ?? "{}"); fixture.handoff = { id: "thread-1", workspaceId: "demo-workspace", subject: String(body.subject ?? "trade_in_review: Ethan Brown needs appraisal"), leadId: lead.id, createdByUserId: "va-1", assignedToUserId: String(body.assignedToUserId ?? "admin-1"), priority: String(body.priority ?? "high"), status: "open", resolvedAt: null, version: 1, leadName: "Ethan Brown", creatorName: "Priya Shah" }; fixture.messages = [{ id: "message-1", threadId: "thread-1", authorUserId: "va-1", body: String(body.body ?? "Customer needs a trade estimate before proceeding."), createdAt: "2026-09-20T10:00:00.000Z", authorName: "Priya Shah" }]; return route.fulfill({ status: 201, json: { data: fixture.handoff } }); }
    if (path.endsWith("/customer-operations/inbox")) return route.fulfill({ json: { data: fixture.handoff ? [fixture.handoff] : [] } });
    if (path.endsWith("/customer-operations/inbox/thread-1/messages") && route.request().method() === "POST") { const body = JSON.parse(route.request().postData() ?? "{}"); fixture.messages.push({ id: `message-${fixture.messages.length + 1}`, threadId: "thread-1", authorUserId: fixture.role === "admin" ? "admin-1" : "va-1", body: String(body.body ?? "Please bring the appraisal to the sales desk."), createdAt: "2026-09-20T10:05:00.000Z", authorName: fixture.role === "admin" ? "Sales Manager" : "Priya Shah" }); fixture.handoff = fixture.handoff ? { ...fixture.handoff, status: "waiting", version: fixture.handoff.version + 1 } : fixture.handoff; return route.fulfill({ status: 201, json: { data: fixture.messages.at(-1) } }); }
    if (path.endsWith("/customer-operations/inbox/thread-1") && route.request().method() === "GET") return route.fulfill({ json: { data: { thread: fixture.handoff, messages: fixture.messages } } });
    if (path.endsWith("/customer-operations/inbox/thread-1") && route.request().method() === "PATCH") { fixture.handoff = fixture.handoff ? { ...fixture.handoff, status: "resolved", resolvedAt: "2026-09-20T10:10:00.000Z", version: fixture.handoff.version + 1 } : fixture.handoff; return route.fulfill({ json: { data: fixture.handoff } }); }
    if (path.endsWith("/customer-operations/performance")) return route.fulfill({ json: { data: { userId: currentUser.id, leadsAssigned: 2, leadsContacted: 2, followUpsCompleted: fixture.followUpStatus === "completed" ? 1 : 0, overdueFollowUps: 0, appointmentsBooked: fixture.appointments.length, appointmentsConfirmed: 0, appointmentsCompleted: 0, noShows: 0 } } });
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
  await expect(page.getByRole("heading", { name: /Your dealership pipeline at a glance|A clear view of team readiness/ })).toBeVisible();
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
  await expect(page.locator(".status-chip.waiting")).toBeVisible();
  await page.getByLabel("Reply to this operational thread").fill("I have accepted the handoff and will confirm the appointment.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("I have accepted the handoff and will confirm the appointment.")).toBeVisible();
});

test("employee completes an overdue follow-up and advances a confirmed appointment", async ({ page }) => {
  const fixture = createCustomerOperationsFixture();
  fixture.role = "employee";
  await mockVAOperationsApi(page, fixture);
  await page.goto("/app/my-day");
  await expect(page.getByRole("heading", { name: "My day, clearly prioritized." })).toBeVisible();
  await page.getByRole("link", { name: "Open follow-ups" }).click();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText("completed")).toBeVisible();
  await page.getByRole("link", { name: "Appointments" }).click();
  await page.getByRole("button", { name: "New appointment" }).click();
  await page.getByLabel("Lead").selectOption("lead-1");
  await page.getByLabel("Type").selectOption("test_drive");
  await page.getByLabel("Notes").fill("Confirm vehicle preparation");
  await page.getByRole("button", { name: "Save appointment" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Completed" }).click();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();
});

test("employee creates a manager request and sees the resolved admin response", async ({ page }) => {
  const fixture = createCustomerOperationsFixture();
  fixture.role = "employee";
  await mockVAOperationsApi(page, fixture);
  await page.goto("/app/inbox");
  await page.getByRole("button", { name: "New manager request" }).click();
  await page.getByLabel("Subject").fill("Need trade valuation context");
  await page.getByLabel("Priority").selectOption("high");
  await page.getByLabel("Assign to").selectOption("admin-1");
  await page.getByLabel("Message").fill("Please confirm the trade valuation guidance for this customer.");
  await page.getByRole("button", { name: "Send manager request" }).click();
  await expect(page.getByText("manager_help: Need trade valuation context")).toBeVisible();

  fixture.role = "admin";
  await page.goto("/app/inbox");
  await page.getByRole("button", { name: /manager_help: Need trade valuation context/ }).click();
  await page.getByPlaceholder("Reply with useful customer context…").fill("Use the standard trade appraisal workflow.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Use the standard trade appraisal workflow.")).toBeVisible();
  const statusSelect = page.getByLabel("Thread status");
  await statusSelect.selectOption("resolved");
  await expect(statusSelect).toHaveValue("resolved");

  fixture.role = "employee";
  await page.goto("/app/inbox");
  await page.getByRole("button", { name: /manager_help: Need trade valuation context/ }).click();
  await expect(page.getByText("Use the standard trade appraisal workflow.")).toBeVisible();
  await expect(page.locator(".status-chip.resolved")).toBeVisible();
});

test("virtual assistant completes a follow-up and books the next customer appointment", async ({ page }) => {
  const fixture = createCustomerOperationsFixture();
  await mockVAOperationsApi(page, fixture);
  await page.goto("/app/my-day");
  await expect(page.getByRole("heading", { name: "My day, clearly prioritized." })).toBeVisible();
  await expect(page.getByText("Confirm test-drive timing")).toBeVisible();
  await page.getByRole("link", { name: "Open follow-ups" }).click();
  await expect(page.getByText("1 follow-ups")).toBeVisible();
  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText("completed")).toBeVisible();
  await page.getByRole("link", { name: "Appointments" }).click();
  await page.getByRole("button", { name: "New appointment" }).click();
  await page.getByLabel("Lead").selectOption("lead-1");
  await page.getByLabel("Type").selectOption("test_drive");
  await page.getByLabel("Notes").fill("Bring vehicle history");
  await page.getByRole("button", { name: "Save appointment" }).click();
  await expect(page.getByText("1 appointments")).toBeVisible();
  await expect(page.getByText("test drive · Priya Shah")).toBeVisible();
});

test("virtual assistant creates a handoff and admin replies and resolves it", async ({ page }) => {
  const fixture = createCustomerOperationsFixture();
  await mockVAOperationsApi(page, fixture);
  await page.goto("/app/leads");
  await expect(page.getByText("Ethan Brown")).toBeVisible();
  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Ethan Brown" })).toBeVisible();
  await page.getByRole("dialog", { name: "Ethan Brown" }).getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Operations inbox" }).click();
  await page.getByRole("button", { name: "New handoff" }).click();
  await page.getByLabel("Subject").fill("Ethan Brown needs appraisal");
  await page.getByLabel("Priority").selectOption("high");
  await page.getByLabel("Assign to").selectOption("admin-1");
  await page.getByLabel("Message").fill("Customer needs a trade estimate before proceeding.");
  await page.getByRole("button", { name: "Send handoff" }).click();
  await expect(page.getByText("manager_help: Ethan Brown needs appraisal")).toBeVisible();

  await page.reload();
  fixture.role = "admin";
  await page.goto("/app/inbox");
  await page.getByRole("button", { name: /manager_help: Ethan Brown/ }).click();
  await page.getByPlaceholder("Reply with useful customer context…").fill("Please bring the appraisal to the sales desk.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByText("Please bring the appraisal to the sales desk.")).toBeVisible();
  const statusSelect = page.locator(".thread-admin-controls select").first();
  await statusSelect.selectOption("resolved");
  await expect(statusSelect).toHaveValue("resolved");

  fixture.role = "virtual_assistant";
  await page.reload();
  await page.goto("/app/inbox");
  await page.getByRole("button", { name: /manager_help: Ethan Brown/ }).click();
  await expect(page.getByText("Please bring the appraisal to the sales desk.")).toBeVisible();
  await expect(page.locator(".status-chip.resolved")).toBeVisible();
});

test("virtual assistant is redirected from every admin-only route", async ({ page }) => {
  const fixture = createCustomerOperationsFixture();
  await mockVAOperationsApi(page, fixture);
  for (const restrictedPath of ["/app/configuration", "/app/source-control", "/app/access-requests", "/app/team", "/app/audit"]) {
    await page.goto(restrictedPath);
    await expect(page).toHaveURL(/\/app\/overview$/);
    await expect(page.getByRole("link", { name: "Configuration" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Source controls" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Access requests" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /Workspace configuration|Source controls|Access requests|Team operations|Audit history/ })).toHaveCount(0);
  }
});

test("employee is redirected from every admin-only route and sees no admin navigation", async ({ page }) => {
  const fixture = createCustomerOperationsFixture();
  fixture.role = "employee";
  await mockVAOperationsApi(page, fixture);
  for (const restrictedPath of ["/app/configuration", "/app/source-control", "/app/access-requests", "/app/team", "/app/audit"]) {
    await page.goto(restrictedPath);
    await expect(page).toHaveURL(/\/app\/overview$/);
    await expect(page.getByRole("link", { name: "Configuration" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Source controls" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Access requests" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Team operations" })).toHaveCount(0);
  }
});
