import { rm, writeFile } from "node:fs/promises";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { closeDatabase, persistScrapedItems, verifyDatabase } from "@rta/db";
import { createRedisConnectionConfig, loadConfig, logger } from "@rta/shared";
import { scrapeSite } from "@rta/scrapers";

const config = loadConfig();
const connection = createRedisConnectionConfig(config);
const queue = new Queue("vehicle-scrape", { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } } });

type ScrapeJobData = { type: "scrape-all-sites"; siteKey: string; limit?: number; lockToken?: string };
const scrapeLockKey = "rta:scrape:active";
const lockRedis = new Redis({ ...connection, lazyConnect: true });

async function releaseScrapeLock(lockToken?: string): Promise<void> {
  if (!lockToken) return;
  if (lockRedis.status === "wait") await lockRedis.connect();
  await lockRedis.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", 1, scrapeLockKey, lockToken);
}

async function scrapeAllSites(siteKey: string, requestedLimit = config.SCRAPE_DEFAULT_LIMIT): Promise<void> {
  if (!config.sites.length) { logger.warn("no sites configured; provide SCRAPER_SITES_JSON before enabling real scraping"); return; }
  const sites = config.sites.filter((site) => site.key === siteKey);
  if (!sites.length) throw new Error(`site key is not configured: ${siteKey}`);
  const limit = Math.min(Math.max(Math.trunc(requestedLimit), 1), config.SCRAPE_MAX_LIMIT);
  const failures: string[] = [];
  for (const site of sites) {
    const startedAt = Date.now();
    try {
      const items = await scrapeSite(site, {
        userAgent: config.SCRAPER_USER_AGENT,
        delayMs: site.delayMs,
        maxConcurrency: 1,
        limit,
        navigationTimeoutMs: config.SCRAPE_NAVIGATION_TIMEOUT_MS,
        selectorTimeoutMs: config.SCRAPE_SELECTOR_TIMEOUT_MS,
        jobTimeoutMs: config.SCRAPE_JOB_TIMEOUT_MS,
        chromiumExecutablePath: config.CHROMIUM_EXECUTABLE_PATH,
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
  await scrapeAllSites(job.data.siteKey, job.data.limit ?? config.SCRAPE_DEFAULT_LIMIT);
}, { connection, concurrency: config.WORKER_CONCURRENCY });
worker.on("completed", (job) => {
  void releaseScrapeLock(job.data.lockToken).catch((error) => logger.warn({ err: error }, "could not release scrape lock"));
  logger.info({ jobId: job.id, siteKey: job.data.siteKey, limit: job.data.limit ?? config.SCRAPE_DEFAULT_LIMIT }, "scrape job completed");
});
worker.on("failed", (job, error) => {
  const attempts = job?.opts.attempts ?? 1;
  if (job && job.attemptsMade >= attempts) {
    void releaseScrapeLock(job.data.lockToken).catch((releaseError) => logger.warn({ err: releaseError }, "could not release scrape lock"));
  }
  logger.error({ jobId: job?.id, siteKey: job?.data.siteKey, err: error }, "scrape job failed");
});

await verifyDatabase();
await queue.waitUntilReady();
await worker.waitUntilReady();
await writeFile("/tmp/rta-worker-ready", "ready\n");
logger.info({ mode: config.MANUAL_SCRAPING_ONLY ? "manual-only" : "manual", sites: config.sites.length, concurrency: config.WORKER_CONCURRENCY, defaultLimit: config.SCRAPE_DEFAULT_LIMIT, maxLimit: config.SCRAPE_MAX_LIMIT, database: "connected", redis: "connected" }, "scraping worker started");

async function shutdown(): Promise<void> { await rm("/tmp/rta-worker-ready", { force: true }); await worker.close(); await queue.close(); await lockRedis.quit().catch(() => undefined); await closeDatabase(); process.exit(0); }
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
