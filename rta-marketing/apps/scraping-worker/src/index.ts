import { rm, writeFile } from "node:fs/promises";
import { Queue, UnrecoverableError, Worker } from "bullmq";
import { Redis } from "ioredis";
import { closeDatabase, persistScrapedItems, verifyDatabase } from "@rta/db";
import { buildSuccessfulScrapeResult, createRedisConnectionConfig, isTerminalScrapeAttempt, legacyWorkerWriteGuard, loadConfig, logger, parseScrapeLimit, SCRAPE_JOB_ATTEMPTS, SCRAPE_LOCK_KEY, SCRAPE_LOCK_REFRESH_SCRIPT, SCRAPE_LOCK_RELEASE_SCRIPT, SCRAPE_RETRY_BACKOFF_MS } from "@rta/shared";
import { scrapeSite, type ScrapeStage, type ScrapeTimings, type ScraperOptions } from "@rta/scrapers";

const config = loadConfig();
const legacyWorkerGuard = legacyWorkerWriteGuard(config);
if (!legacyWorkerGuard.allowed) {
  logger.warn({ event: "legacy_worker_disabled", reason: legacyWorkerGuard.reason }, "Legacy scraper worker is disabled; no production writes will be attempted");
  process.exit(legacyWorkerGuard.exitCode);
}
const connection = createRedisConnectionConfig(config);
const queue = new Queue("vehicle-scrape", { connection, defaultJobOptions: { attempts: SCRAPE_JOB_ATTEMPTS, backoff: { type: "exponential", delay: SCRAPE_RETRY_BACKOFF_MS }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } } });

type ScrapeJobData = { type: "scrape-all-sites"; siteKey: string; limit?: number; lockToken?: string };
type ScrapeJobProgress = { stage: ScrapeStage; attempt: number; maxAttempts: number; requestedCount: number; foundCount?: number; timings?: ScrapeTimings };
type ScrapeSummary = { status: "completed"; requestedCount: number; foundCount: number; timings: ScrapeTimings };
const lockRedis = new Redis({ ...connection, lazyConnect: true });

async function updateJobProgress(job: { updateProgress: (progress: ScrapeJobProgress) => Promise<void> }, progress: ScrapeJobProgress): Promise<void> {
  await job.updateProgress(progress).catch((error: unknown) => logger.warn({ err: error }, "could not update scrape progress"));
}

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

async function scrapeAllSites(siteKey: string, requestedLimit = config.SCRAPE_DEFAULT_LIMIT, onStage?: (stage: ScrapeStage, foundCount: number, timings: ScrapeTimings) => Promise<void>): Promise<ScrapeSummary> {
  const startedAt = Date.now();
  const timings: ScrapeTimings = {};
  if (!config.sites.length) {
    logger.warn("no sites configured; provide SCRAPER_SITES_JSON before enabling real scraping");
    timings.totalDurationMs = Date.now() - startedAt;
    return { ...buildSuccessfulScrapeResult(requestedLimit, 0), timings };
  }
  const sites = config.sites.filter((site) => site.key === siteKey);
  if (!sites.length) throw new Error(`site key is not configured: ${siteKey}`);
  const limit = parseScrapeLimit(requestedLimit, config.SCRAPE_DEFAULT_LIMIT, config.SCRAPE_MAX_LIMIT);
  const failures: string[] = [];
  let foundCount = 0;
  for (const site of sites) {
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
        timings,
        onStage: (stage) => onStage?.(stage, foundCount, timings),
      } satisfies ScraperOptions);
      foundCount += items.length;
      await onStage?.("saving", foundCount, timings);
      const persistenceStartedAt = Date.now();
      await persistScrapedItems(site, items);
      timings.persistenceMs = (timings.persistenceMs ?? 0) + Date.now() - persistenceStartedAt;
      logger.info({ site: site.name, engine: site.engine, items: items.length, requestedLimit: limit, foundCount: items.length, timings }, "site scrape completed");
    } catch (error) {
      failures.push(site.name);
      logger.error({ site: site.name, engine: site.engine, err: error }, "site scrape failed");
    }
  }
  if (failures.length) throw new Error(`scrape failed for: ${failures.join(", ")}`);
  timings.totalDurationMs = Date.now() - startedAt;
  return { ...buildSuccessfulScrapeResult(limit, foundCount), timings };
}

for (const site of config.sites) await persistScrapedItems(site, []);
const worker = new Worker<ScrapeJobData>("vehicle-scrape", async (job) => {
  const maxAttempts = Number(job.opts.attempts ?? SCRAPE_JOB_ATTEMPTS);
  const attempt = Math.min(maxAttempts, job.attemptsMade + 1);
  const requestedCount = job.data.limit ?? config.SCRAPE_DEFAULT_LIMIT;
  const reportStage = (stage: ScrapeStage, foundCount = 0, timings?: ScrapeTimings) => updateJobProgress(job, { stage, attempt, maxAttempts, requestedCount, foundCount, timings });
  const refreshInterval = job.data.lockToken ? setInterval(() => {
    void refreshScrapeLock(job.data.lockToken).catch((error) => logger.warn({ err: error }, "could not refresh scrape lock"));
  }, Math.max(1_000, Math.floor(config.SCRAPE_LOCK_TTL_SECONDS * 1_000 / 3))) : undefined;
  try {
    await reportStage("starting");
    if (!job.data.siteKey) throw new UnrecoverableError("siteKey is required; one source must be selected");
    parseScrapeLimit(job.data.limit, config.SCRAPE_DEFAULT_LIMIT, config.SCRAPE_MAX_LIMIT);
    if (!config.sites.some((site) => site.key === job.data.siteKey)) throw new UnrecoverableError("site key is not configured");
    const summary = await scrapeAllSites(job.data.siteKey, requestedCount, async (stage, foundCount, timings) => reportStage(stage, foundCount, timings));
    await reportStage("completed", summary.foundCount, summary.timings);
    return summary;
  } catch (error) {
    const unrecoverable = error instanceof UnrecoverableError || (error instanceof Error && error.name === "UnrecoverableError");
    const terminal = isTerminalScrapeAttempt(job.attemptsMade, maxAttempts, unrecoverable || (error instanceof Error && /limit must|limit cannot exceed/.test(error.message)));
    await reportStage(terminal ? "failed" : "retrying").catch(() => undefined);
    if (error instanceof Error && /limit must|limit cannot exceed/.test(error.message)) throw new UnrecoverableError(error.message);
    throw error;
  } finally {
    if (refreshInterval) clearInterval(refreshInterval);
  }
}, { connection, concurrency: config.WORKER_CONCURRENCY });
worker.on("completed", (job) => {
  void releaseScrapeLock(job.data.lockToken).catch((error) => logger.warn({ err: error }, "could not release scrape lock"));
  const summary = job.returnvalue as ScrapeSummary | undefined;
  logger.info({ jobId: job.id, siteKey: job.data.siteKey, requestedCount: summary?.requestedCount ?? job.data.limit ?? config.SCRAPE_DEFAULT_LIMIT, foundCount: summary?.foundCount ?? 0, timings: summary?.timings }, "scrape job completed");
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
