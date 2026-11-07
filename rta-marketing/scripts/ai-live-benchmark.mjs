#!/usr/bin/env node

/*
 * Safe live assistant benchmark.
 *
 * It sends bounded read-only assistant questions only. It never logs or stores
 * cookies, CSRF tokens, passwords, provider keys, full answers, or document
 * contents. Authenticated runs use an already-created browser session.
 */

const baseUrl = (process.env.AI_BENCHMARK_BASE_URL ?? "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("Set AI_BENCHMARK_BASE_URL, for example https://api.example.com/api/v1");
  process.exitCode = 1;
  process.exit();
}

const cookie = process.env.AI_BENCHMARK_COOKIE;
const csrfToken = process.env.AI_BENCHMARK_CSRF_TOKEN;
const role = process.env.AI_BENCHMARK_ROLE ?? (cookie ? "authenticated-session" : "public");
const runs = Math.max(1, Math.min(Number(process.env.AI_BENCHMARK_RUNS ?? "1"), 10));
const leadId = process.env.AI_BENCHMARK_LEAD_ID;
const vehicleId = process.env.AI_BENCHMARK_VEHICLE_ID;
const compareIds = (process.env.AI_BENCHMARK_COMPARE_IDS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
const scrapeRunId = process.env.AI_BENCHMARK_RUN_ID;
const outputPath = process.env.AI_BENCHMARK_OUTPUT ?? `/tmp/rta-ai-benchmark-${Date.now()}.json`;

const cases = [
  { id: "public-landing", question: "What does Dealer Flow do and how is it secured?", role: "public", page: "/", expectedTool: "getPlatformHelp", context: { route: "/", entityType: "none" }, authenticated: false },
  { id: "dashboard", question: "Summarize this month's authorized dashboard metrics.", page: "/app/overview", expectedTool: "getDashboardSummary", context: { route: "/app/overview", entityType: "none" }, authenticated: true },
  { id: "lead-detail", question: "What is the next best action for this lead?", page: "/app/leads", expectedTool: "getLeadNextAction", context: { route: "/app/leads", entityType: "lead", entityId: leadId }, authenticated: true, requires: leadId },
  { id: "inventory", question: "Recommend active vehicles for a practical budget-conscious buyer.", page: "/app/inventory", expectedTool: "recommendVehicles", context: { route: "/app/inventory", entityType: "vehicle" }, authenticated: true },
  { id: "vehicle-comparison", question: "Compare these selected vehicles using active listings.", page: "/app/compare", expectedTool: "compareVehicleListings", context: { route: "/app/compare", entityType: "vehicle", entityId: compareIds[0] }, authenticated: true, requires: compareIds.length >= 2 ? compareIds.join(",") : undefined },
  { id: "sales", question: "Give me sales performance and commission insights for this month.", page: "/app/sales", expectedTool: "getPerformanceInsights", context: { route: "/app/sales", entityType: "sale" }, authenticated: true },
  { id: "analytics", question: "Explain this month's lead funnel and conversion rate.", page: "/app/analytics", expectedTool: "getAnalyticsSummary", context: { route: "/app/analytics", entityType: "sale" }, authenticated: true },
  { id: "scraping-status", question: "What is the current scraping source and run status?", page: "/app/acquisition", expectedTool: "getScrapingStatus", context: { route: "/app/acquisition", entityType: "scrape_run" }, authenticated: true },
  { id: "scraping-error", question: "Troubleshoot the latest scraping failure without starting a job.", page: "/app/acquisition", expectedTool: "troubleshootScraping", context: { route: "/app/acquisition", entityType: "scrape_run", entityId: scrapeRunId }, authenticated: true, requires: scrapeRunId },
];

function percentile(values, percentage) {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentage) - 1));
  return values[index];
}

function stats(records) {
  const values = records.map((record) => record.latencyMs).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!values.length) return { minimumMs: null, averageMs: null, p50Ms: null, p95Ms: null, maximumMs: null };
  return {
    minimumMs: values[0],
    averageMs: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maximumMs: values.at(-1),
  };
}

function actualTool(payload) {
  const sources = Array.isArray(payload?.data?.sources) ? payload.data.sources : [];
  const source = sources.find((item) => typeof item?.label === "string" && /^get[A-Z]/.test(item.label));
  return source?.label ?? (sources.some((item) => item?.kind === "product") ? "getPlatformHelp" : null);
}

function securityNotes(record, testCase) {
  const notes = [];
  if (!testCase.authenticated) notes.push("Public-safe case; no workspace tool should be available.");
  if (testCase.id === "scraping-error") notes.push("Must remain diagnostic-only; confirm no scrape job was created.");
  if (testCase.id === "inventory" || testCase.id === "vehicle-comparison") notes.push("Validate every returned vehicle/listing against the read-only inventory endpoint or database.");
  if (record.provider === "deterministic") notes.push("Provider unavailable/disabled; deterministic fallback was used.");
  return notes.join(" ");
}

async function runCase(testCase, iteration) {
  if (testCase.authenticated && !cookie) {
    return { caseId: testCase.id, iteration, question: testCase.question, role: testCase.authenticated ? role : "public", page: testCase.page, expectedTool: testCase.expectedTool, provider: "not-run", latencyMs: null, result: "SKIPPED_NO_SESSION", passFail: "SKIP", securityNotes: "Provide an existing authenticated cookie and CSRF token for this case; no login or password is attempted." };
  }
  if (testCase.requires === undefined || testCase.requires === "") {
    if (testCase.id === "lead-detail" || testCase.id === "vehicle-comparison" || testCase.id === "scraping-error") {
      return { caseId: testCase.id, iteration, question: testCase.question, role: testCase.authenticated ? role : "public", page: testCase.page, expectedTool: testCase.expectedTool, provider: "not-run", latencyMs: null, result: "SKIPPED_MISSING_SAFE_ID", passFail: "SKIP", securityNotes: "Set the corresponding sanitized demo ID; the benchmark never queries private documents." };
    }
  }
  const context = { ...testCase.context };
  if (testCase.id === "vehicle-comparison") context.vehicleIds = compareIds;
  const requestId = `ai-benchmark-${Date.now()}-${iteration}-${testCase.id}`;
  const headers = { "content-type": "application/json", "x-request-id": requestId };
  if (cookie) headers.cookie = cookie;
  if (csrfToken) headers["x-csrf-token"] = csrfToken;
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}/assistant/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: testCase.question, history: [], context }),
      signal: AbortSignal.timeout(30_000),
    });
    const latencyMs = Math.round((performance.now() - started) * 100) / 100;
    const payload = await response.json().catch(() => null);
    const provider = payload?.data?.provider ?? "unknown";
    const tool = actualTool(payload);
    const pass = response.ok && (tool === testCase.expectedTool || (testCase.expectedTool === "getPlatformHelp" && provider === "deterministic"));
    const record = { caseId: testCase.id, iteration, question: testCase.question, role: testCase.authenticated ? role : "public", page: testCase.page, expectedTool: testCase.expectedTool, actualTool: tool, provider, latencyMs, result: response.ok ? "HTTP_200" : `HTTP_${response.status}`, passFail: pass ? "PASS" : "FAIL", securityNotes: "" };
    record.securityNotes = securityNotes(record, testCase);
    return record;
  } catch (error) {
    const latencyMs = Math.round((performance.now() - started) * 100) / 100;
    return { caseId: testCase.id, iteration, question: testCase.question, role: testCase.authenticated ? role : "public", page: testCase.page, expectedTool: testCase.expectedTool, provider: "request-error", latencyMs, result: "REQUEST_ERROR", passFail: "FAIL", securityNotes: error instanceof Error ? error.name : "Request failed" };
  }
}

const records = [];
for (let iteration = 1; iteration <= runs; iteration += 1) {
  for (const testCase of cases) records.push(await runCase(testCase, iteration));
}

const executed = records.filter((record) => record.latencyMs !== null);
const summary = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  role,
  runs,
  counts: {
    totalCases: records.length,
    executed: executed.length,
    skipped: records.filter((record) => record.passFail === "SKIP").length,
    passed: records.filter((record) => record.passFail === "PASS").length,
    failed: records.filter((record) => record.passFail === "FAIL").length,
    providers: Object.fromEntries([...new Set(records.map((record) => record.provider))].map((provider) => [provider, records.filter((record) => record.provider === provider).length])),
    tools: Object.fromEntries([...new Set(records.map((record) => record.actualTool).filter(Boolean))].map((tool) => [tool, records.filter((record) => record.actualTool === tool).length])),
  },
  latency: stats(executed),
  records,
};

await import("node:fs/promises").then(({ writeFile }) => writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 }));
console.log(JSON.stringify({ outputPath, counts: summary.counts, latency: summary.latency }, null, 2));
