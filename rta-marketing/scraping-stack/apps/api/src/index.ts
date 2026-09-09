import express from "express";
import { Job, Queue } from "bullmq";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { count, desc, eq, max } from "drizzle-orm";
import { db, schema, verifyDatabase } from "@rta/db";
import { createRedisConnectionConfig, loadConfig, logger } from "@rta/shared";

const config = loadConfig();
const connection = createRedisConnectionConfig(config);
const redis = new Redis({ ...connection, lazyConnect: true });
const scrapeQueue = new Queue("vehicle-scrape", {
  connection,
});
type ScrapeJobData = { type: "scrape-all-sites"; siteKey?: string; limit?: number; lockToken?: string };
const activeJobStates = ["waiting", "active", "delayed", "prioritized", "paused"] as const;
const scrapeLockKey = "rta:scrape:active";
const manualScrapeCooldown = new Map<string, number>();
const app = express();
app.use(express.json({ limit: "64kb" }));

function clampScrapeLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return config.SCRAPE_DEFAULT_LIMIT;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error("limit must be a number");
  return Math.min(Math.max(Math.trunc(parsed), 1), config.SCRAPE_MAX_LIMIT);
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
    failedReason: job.failedReason ?? null,
  };
}

async function getActiveJob(): Promise<Job<ScrapeJobData> | undefined> {
  const jobs = await scrapeQueue.getJobs([...activeJobStates], 0, 0);
  return jobs[0] as Job<ScrapeJobData> | undefined;
}

async function releaseScrapeLock(lockToken: string): Promise<void> {
  if (redis.status === "wait") await redis.connect();
  await redis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, scrapeLockKey, lockToken);
}

async function acquireScrapeLock(): Promise<string | null> {
  if (redis.status === "wait") await redis.connect();
  const lockToken = randomUUID();
  const acquired = await redis.set(scrapeLockKey, lockToken, "EX", config.SCRAPE_LOCK_TTL_SECONDS, "NX");
  return acquired === "OK" ? lockToken : null;
}
app.use((request, response, next) => {
  response.setHeader("Access-Control-Allow-Origin", config.CORS_ORIGIN);
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") return response.sendStatus(204);
  next();
});

app.get("/health", async (_request, response) => {
  try {
    await verifyDatabase();
    if (redis.status === "wait") await redis.connect();
    await redis.ping();
    response.json({ status: "ok", database: "ok", redis: "ok" });
  } catch (error) {
    logger.error({ err: error }, "dependency health check failed");
    response.status(503).json({ status: "error", message: error instanceof Error ? error.message : "dependency check failed" });
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
  const siteKey = request.params.siteKey;
  const site = config.sites.find((configuredSite) => configuredSite.key === siteKey);
  if (!site) return response.status(404).json({ error: "site is not configured" });

  let limit: number;
  try {
    limit = clampScrapeLimit(request.body?.limit);
  } catch (error) {
    return response.status(400).json({ error: error instanceof Error ? error.message : "invalid scrape limit" });
  }

  const activeJob = await getActiveJob();
  if (activeJob) {
    const activeStatus = await describeJob(activeJob);
    if (activeJob.data.siteKey === siteKey) return response.status(202).json({ data: activeStatus, reused: true });
    return response.status(409).json({ error: "another scrape is already queued or running", data: { activeJob: activeStatus } });
  }

  const availableAt = manualScrapeCooldown.get(siteKey) ?? 0;
  if (Date.now() < availableAt) {
    return response.status(429).json({ error: "site was triggered recently", retryAfterSeconds: Math.ceil((availableAt - Date.now()) / 1000) });
  }

  const lockToken = await acquireScrapeLock();
  if (!lockToken) {
    const lockedJob = await getActiveJob();
    return response.status(409).json({ error: "another scrape is already queued or running", data: { activeJob: lockedJob ? await describeJob(lockedJob) : null } });
  }

  const jobId = `manual-${siteKey}`;
  try {
    const previousJob = await scrapeQueue.getJob(jobId) as Job<ScrapeJobData> | undefined;
    if (previousJob) await previousJob.remove();
    const job = await scrapeQueue.add(
      `manual-${siteKey}`,
      { type: "scrape-all-sites", siteKey, limit, lockToken },
      { jobId, attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
    );
    manualScrapeCooldown.set(siteKey, Date.now() + 15_000);
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
  response.status(500).json({ error: error instanceof Error ? error.message : "request failed" });
});

const server = app.listen(config.API_PORT, "0.0.0.0", () => logger.info({ port: config.API_PORT }, "scraping API listening"));
async function shutdown(): Promise<void> { server.close(); await scrapeQueue.close().catch(() => undefined); await redis.quit().catch(() => undefined); process.exit(0); }
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
