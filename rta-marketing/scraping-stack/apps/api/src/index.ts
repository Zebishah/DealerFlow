import express from "express";
import { Job, Queue } from "bullmq";
import { Redis } from "ioredis";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { count, desc, eq, max } from "drizzle-orm";
import { db, schema, verifyDatabase } from "@rta/db";
import { assertSingleSourcePayload, createRedisConnectionConfig, findConfiguredSite, isScrapeTokenValid, loadConfig, logger, manualScrapeJobId, parseScrapeLimit, rateLimitDecision, SCRAPE_LOCK_KEY, SCRAPE_LOCK_RELEASE_SCRIPT } from "@rta/shared";

const config = loadConfig({ requireScrapeAuth: true });
const connection = createRedisConnectionConfig(config);
const redis = new Redis({ ...connection, lazyConnect: true });
const scrapeQueue = new Queue("vehicle-scrape", {
  connection,
});
type ScrapeJobData = { type: "scrape-all-sites"; siteKey?: string; limit?: number; lockToken?: string };
const activeJobStates = ["waiting", "active", "delayed", "prioritized", "paused"] as const;
const sessionCookieName = "rta_scrape_session";
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "64kb" }));

function clientAddress(request: express.Request): string {
  return request.ip || request.socket.remoteAddress || "unknown";
}

async function consumeRateLimit(namespace: string, request: express.Request, maximum: number): Promise<{ allowed: boolean; retryAfterSeconds: number; remaining: number }> {
  if (redis.status === "wait") await redis.connect();
  const keyHash = createHash("sha256").update(clientAddress(request)).digest("hex");
  const key = `rta:rate:${namespace}:${keyHash}`;
  const result = await redis.eval(
    "local count = redis.call('incr', KEYS[1]); if count == 1 then redis.call('pexpire', KEYS[1], ARGV[1]) end; return {count, redis.call('pttl', KEYS[1])}",
    1,
    key,
    String(config.SCRAPE_RATE_LIMIT_WINDOW_MS),
  ) as [number, number];
  const count = Number(result[0]);
  const ttlMs = Math.max(0, Number(result[1]));
  return rateLimitDecision(count, maximum, ttlMs);
}

function setRateLimitHeaders(response: express.Response, maximum: number, result: { retryAfterSeconds: number; remaining: number }): void {
  response.setHeader("X-RateLimit-Limit", String(maximum));
  response.setHeader("X-RateLimit-Remaining", String(result.remaining));
}

function readCookie(request: express.Request, name: string): string | null {
  const cookieHeader = request.headers.cookie ?? "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function sessionKey(sessionToken: string): string {
  return `rta:scrape:session:${createHash("sha256").update(sessionToken).digest("hex")}`;
}

async function hasValidScrapeSession(request: express.Request): Promise<boolean> {
  const sessionToken = readCookie(request, sessionCookieName);
  if (!sessionToken) return false;
  if (redis.status === "wait") await redis.connect();
  return (await redis.get(sessionKey(sessionToken))) === "1";
}

async function hasValidScrapeCredential(request: express.Request): Promise<boolean> {
  const authorization = request.headers.authorization;
  if (authorization?.startsWith("Bearer ") && isScrapeTokenValid(config.SCRAPE_TRIGGER_TOKEN, authorization.slice("Bearer ".length))) return true;
  return hasValidScrapeSession(request);
}

function setSessionCookie(response: express.Response, value: string, maxAge: number): void {
  const sameSite = config.NODE_ENV === "production" ? "None" : "Lax";
  const secure = config.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${sessionCookieName}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=${sameSite}${secure}`);
}

function clearSessionCookie(response: express.Response): void {
  setSessionCookie(response, "", 0);
}

function publicJobStatus(state: string): "queued" | "scraping" | "completed" | "failed" {
  if (state === "active") return "scraping";
  if (state === "completed") return "completed";
  if (state === "failed") return "failed";
  return "queued";
}

async function describeJob(job: Job<ScrapeJobData>): Promise<Record<string, unknown>> {
  const state = await job.getState();
  return {
    jobId: job.id,
    siteKey: job.data.siteKey ?? "all",
    limit: job.data.limit ?? config.SCRAPE_DEFAULT_LIMIT,
    status: publicJobStatus(state),
    failedReason: state === "failed" ? "scrape failed after retries" : null,
  };
}

async function getActiveJob(): Promise<Job<ScrapeJobData> | undefined> {
  const jobs = await scrapeQueue.getJobs([...activeJobStates], 0, 0);
  return jobs[0] as Job<ScrapeJobData> | undefined;
}

async function releaseScrapeLock(lockToken: string): Promise<void> {
  if (redis.status === "wait") await redis.connect();
  await redis.eval(SCRAPE_LOCK_RELEASE_SCRIPT, 1, SCRAPE_LOCK_KEY, lockToken);
}

async function acquireScrapeLock(): Promise<string | null> {
  if (redis.status === "wait") await redis.connect();
  const lockToken = randomUUID();
  const acquired = await redis.set(SCRAPE_LOCK_KEY, lockToken, "EX", config.SCRAPE_LOCK_TTL_SECONDS, "NX");
  return acquired === "OK" ? lockToken : null;
}
app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", config.CORS_ORIGIN);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

app.post("/api/scrape-session", async (request, response) => {
  const rate = await consumeRateLimit("auth", request, config.SCRAPE_AUTH_RATE_LIMIT_MAX);
  setRateLimitHeaders(response, config.SCRAPE_AUTH_RATE_LIMIT_MAX, rate);
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return response.status(429).json({ error: "authentication rate limit exceeded", retryAfterSeconds: rate.retryAfterSeconds });
  }
  const authBody = request.body && typeof request.body === "object" && !Array.isArray(request.body) ? request.body as Record<string, unknown> : {};
  if (Object.keys(authBody).some((key) => !["token", "accessCode"].includes(key))) return response.status(400).json({ error: "invalid authentication request" });
  const submittedToken = authBody.token;
  const submittedAccessCode = authBody.accessCode;
  if (!isScrapeTokenValid(config.SCRAPE_TRIGGER_TOKEN, submittedToken) && !isScrapeTokenValid(config.SCRAPE_ACCESS_CODE, submittedAccessCode)) {
    return response.status(401).json({ error: "scrape access denied" });
  }
  const sessionToken = randomBytes(32).toString("base64url");
  if (redis.status === "wait") await redis.connect();
  await redis.set(sessionKey(sessionToken), "1", "EX", config.SCRAPE_SESSION_TTL_SECONDS);
  setSessionCookie(response, sessionToken, config.SCRAPE_SESSION_TTL_SECONDS);
  response.setHeader("Cache-Control", "no-store");
  response.json({ data: { authenticated: true } });
});

app.get("/api/scrape-session", async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.json({ data: { authenticated: await hasValidScrapeSession(request) } });
});

app.post("/api/scrape-session/logout", async (request, response) => {
  const sessionToken = readCookie(request, sessionCookieName);
  if (sessionToken) {
    if (redis.status === "wait") await redis.connect();
    await redis.del(sessionKey(sessionToken));
  }
  clearSessionCookie(response);
  response.json({ data: { authenticated: false } });
});

app.get("/health", async (_request, response) => {
  try {
    await verifyDatabase();
    if (redis.status === "wait") await redis.connect();
    await redis.ping();
    response.json({ status: "ok", database: "ok", redis: "ok" });
  } catch (error) {
    logger.error({ err: error }, "dependency health check failed");
    response.status(503).json({ status: "error", message: "dependencies unavailable" });
  }
});

app.get("/api/sites", async (_request, response) => {
  const rows = await db.select({ id: schema.sites.id, name: schema.sites.name, baseUrl: schema.sites.baseUrl, itemCount: count(schema.scrapedItems.id), lastScrapedAt: max(schema.scrapedItems.scrapedAt) })
    .from(schema.sites).leftJoin(schema.scrapedItems, eq(schema.scrapedItems.siteId, schema.sites.id)).groupBy(schema.sites.id).orderBy(schema.sites.id);
  response.json({ data: rows });
});

app.get("/api/scrape/status", async (_request, response) => {
  const activeJob = await getActiveJob();
  response.json({ data: { activeJob: activeJob ? await describeJob(activeJob) : null, defaultLimit: config.SCRAPE_DEFAULT_LIMIT, maxLimit: config.SCRAPE_MAX_LIMIT } });
});

app.get("/api/scrape/jobs/:jobId", async (request, response) => {
  const job = await scrapeQueue.getJob(request.params.jobId) as Job<ScrapeJobData> | undefined;
  if (!job) return response.status(404).json({ error: "scrape job not found" });
  response.json({ data: await describeJob(job) });
});

app.post("/api/scrape/:siteKey", async (request, response) => {
  if (!await hasValidScrapeCredential(request)) return response.status(401).json({ error: "scrape access denied" });
  const rate = await consumeRateLimit("scrape", request, config.SCRAPE_RATE_LIMIT_MAX);
  setRateLimitHeaders(response, config.SCRAPE_RATE_LIMIT_MAX, rate);
  if (!rate.allowed) {
    response.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return response.status(429).json({ error: "scrape rate limit exceeded", retryAfterSeconds: rate.retryAfterSeconds });
  }
  const siteKey = request.params.siteKey;
  let site;
  try {
    site = findConfiguredSite(siteKey, config.sites);
  } catch {
    return response.status(404).json({ error: "site is not configured" });
  }

  let limit: number;
  try {
    assertSingleSourcePayload(request.body);
    if (request.body?.siteKey !== undefined && request.body.siteKey !== siteKey) throw new Error("siteKey must match the route source");
    limit = parseScrapeLimit(request.body?.limit, config.SCRAPE_DEFAULT_LIMIT, config.SCRAPE_MAX_LIMIT);
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "invalid scrape limit" });
  }

  const activeJob = await getActiveJob();
  if (activeJob) {
    const activeStatus = await describeJob(activeJob);
    return response.status(409).json({ error: "another scrape is already queued or running", data: { activeJob: activeStatus } });
  }

  const lockToken = await acquireScrapeLock();
  if (!lockToken) {
    const lockedJob = await getActiveJob();
    return response.status(409).json({ error: "another scrape is already queued or running", data: { activeJob: lockedJob ? await describeJob(lockedJob) : null } });
  }

  const jobId = manualScrapeJobId(siteKey);
  try {
    const previousJob = await scrapeQueue.getJob(jobId) as Job<ScrapeJobData> | undefined;
    if (previousJob) await previousJob.remove();
    const job = await scrapeQueue.add(
      manualScrapeJobId(siteKey),
      { type: "scrape-all-sites", siteKey, limit, lockToken },
      { jobId, attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
    );
    response.status(202).json({ data: await describeJob(job) });
  } catch (error) {
    await releaseScrapeLock(lockToken).catch(() => undefined);
    throw error;
  }
});

app.get("/api/sites/:siteId", async (request, response) => {
  const siteId = Number(request.params.siteId);
  if (!Number.isInteger(siteId) || siteId < 1) return response.status(400).json({ error: "siteId must be a positive integer" });
  const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, siteId)).limit(1);
  if (!site) return response.status(404).json({ error: "site not found" });
  const items = await db.select().from(schema.scrapedItems).where(eq(schema.scrapedItems.siteId, siteId)).orderBy(desc(schema.scrapedItems.scrapedAt)).limit(100);
  response.json({ data: { site, items } });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  logger.error({ err: error }, "API request failed");
  response.status(500).json({ error: "request failed" });
});

const server = app.listen(config.API_PORT, "0.0.0.0", () => logger.info({ port: config.API_PORT }, "scraping API listening"));
async function shutdown(): Promise<void> { server.close(); await scrapeQueue.close().catch(() => undefined); await redis.quit().catch(() => undefined); process.exit(0); }
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
