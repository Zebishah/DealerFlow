import { rm, writeFile } from "node:fs/promises";
import { Queue, UnrecoverableError, Worker } from "bullmq";
import { Redis } from "ioredis";
import { closeDatabase, persistScrapedItems, verifyDatabase } from "@rta/db";
import { createRedisConnectionConfig, loadConfig, logger, parseScrapeLimit, SCRAPE_LOCK_KEY, SCRAPE_LOCK_REFRESH_SCRIPT, SCRAPE_LOCK_RELEASE_SCRIPT } from "@rta/shared";
import { scrapeSite } from "@rta/scrapers";

const config = loadConfig();
const connection = createRedisConnectionConfig(config);
const queue = new Queue("vehicle-scrape", { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } } });

type ScrapeJobData = { type: "scrape-all-sites"; siteKey: string; limit?: number; lockToken?: string };
const lockRedis = new Redis({ ...connection, lazyConnect: true });

async function releaseScrapeLock(lockToken?: string): Promise<void> {
  if (!lockToken) return;
  if (lockRedis.status === "wait") await lockRedis.connect();
  await lockRedis.eval(SCRAPE_LOCK_RELEASE_SCRIPT, 1, SCRAPE_LOCK_KEY, lockToken);
}

async function refreshScrapeLock(lockToken?: string): Promise<void> {
  if (!lockToken) return;
  if (lockRedis.status === "wait") await lockRedis.connect();
  const refreshed = await lockRedis.eval(SCRAPE_LOCK_REFRESH_SCRIPT, 1, SCRAPE_LOCK_KEY, lockToken, String(config.SCRAPE_LOCK_TTL_SECONDS));
  if (Number(refreshed) !== 1) throw new Error("scrape lock is no longer owned by this worker");
}

async function scrapeAllSites(siteKey: string, requestedLimit = config.SCRAPE_DEFAULT_LIMIT): Promise<void> {
  if (!config.sites.length) { logger.warn("no sites configured; provide SCRAPER_SITES_JSON before enabling real scraping"); return; }
  const sites = config.sites.filter((site) => site.key === siteKey);
  if (!sites.length) throw new Error(`site key is not configured: ${siteKey}`);
  const limit = parseScrapeLimit(requestedLimit, config.SCRAPE_DEFAULT_LIMIT, config.SCRAPE_MAX_LIMIT);
  const failures: string[] = [];
  for (const site of sites) {
    const startedAt = Date.now();
    try {
      const items = await scrapeSite(site, {
        userAgent: config.SCRAPER_USER_AGENT,
        delayMs: site.delayMs,
        maxConcurrency: 1,
        limit,
        crawleeMemoryMbytes: config.CRAWLEE_MEMORY_MBYTES,
        navigationTimeoutMs: config.SCRAPE_NAVIGATION_TIMEOUT_MS,
        selectorTimeoutMs: config.SCRAPE_SELECTOR_TIMEOUT_MS,
        jobTimeoutMs: config.SCRAPE_JOB_TIMEOUT_MS,
      });
      await persistScrapedItems(site, items);
      logger.info({ site: site.name, engine: site.engine, items: items.length, limit, durationMs: Date.now() - startedAt }, "site scrape completed");
    } catch (error) {
      failures.push(site.name);
      logger.error({ site: site.name, engine: site.engine, err: error }, "site scrape failed");
    }
  }
  if (failures.length) throw new Error(`scrape failed for: ${failures.join(", ")}`);
}

for (const site of config.sites) await persistScrapedItems(site, []);
const worker = new Worker<ScrapeJobData>("vehicle-scrape", async (job) => {
  const refreshInterval = job.data.lockToken ? setInterval(() => {
    void refreshScrapeLock(job.data.lockToken).catch((error) => logger.warn({ err: error }, "could not refresh scrape lock"));
  }, Math.max(1_000, Math.floor(config.SCRAPE_LOCK_TTL_SECONDS * 1_000 / 3))) : undefined;
  try {
    if (!job.data.siteKey) throw new UnrecoverableError("siteKey is required; one source must be selected");
    parseScrapeLimit(job.data.limit, config.SCRAPE_DEFAULT_LIMIT, config.SCRAPE_MAX_LIMIT);
    if (!config.sites.some((site) => site.key === job.data.siteKey)) throw new UnrecoverableError("site key is not configured");
    await scrapeAllSites(job.data.siteKey, job.data.limit ?? config.SCRAPE_DEFAULT_LIMIT);
  } catch (error) {
    if (error instanceof UnrecoverableError) throw error;
    if (error instanceof Error && /limit must|limit cannot exceed/.test(error.message)) throw new UnrecoverableError(error.message);
    throw error;
  } finally {
    if (refreshInterval) clearInterval(refreshInterval);
  }
}, { connection, concurrency: config.WORKER_CONCURRENCY });
worker.on("completed", (job) => {
  void releaseScrapeLock(job.data.lockToken).catch((error) => logger.warn({ err: error }, "could not release scrape lock"));
  logger.info({ jobId: job.id, siteKey: job.data.siteKey, limit: job.data.limit ?? config.SCRAPE_DEFAULT_LIMIT }, "scrape job completed");
});
worker.on("failed", (job, error) => {
  const attempts = job?.opts.attempts ?? 1;
  if (job && (job.attemptsMade >= attempts || error instanceof UnrecoverableError || error?.name === "UnrecoverableError")) {
    void releaseScrapeLock(job.data.lockToken).catch((releaseError) => logger.warn({ err: releaseError }, "could not release scrape lock"));
  }
  logger.error({ jobId: job?.id, siteKey: job?.data.siteKey, err: error }, "scrape job failed");
});

await verifyDatabase();
await queue.waitUntilReady();
await worker.waitUntilReady();
await writeFile("/tmp/rta-worker-ready", "ready\n");
logger.info({ mode: config.MANUAL_SCRAPING_ONLY ? "manual-only" : "manual", sites: config.sites.length, concurrency: config.WORKER_CONCURRENCY, crawleeMemoryMbytes: config.CRAWLEE_MEMORY_MBYTES, defaultLimit: config.SCRAPE_DEFAULT_LIMIT, maxLimit: config.SCRAPE_MAX_LIMIT, database: "connected", redis: "connected" }, "scraping worker started");

async function shutdown(): Promise<void> { await rm("/tmp/rta-worker-ready", { force: true }); await worker.close(); await queue.close(); await lockRedis.quit().catch(() => undefined); await closeDatabase(); process.exit(0); }
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
