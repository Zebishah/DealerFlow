import { rm, writeFile } from "node:fs/promises";
import { Queue, Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { db, schema, closeDatabase, verifyDatabase } from "@rta/db";
import { loadConfig, logger, type ScrapedItem, type SiteConfig } from "@rta/shared";
import { scrapeSite } from "@rta/scrapers";

const config = loadConfig();
const connection = { host: config.REDIS_HOST, port: config.REDIS_PORT, password: config.REDIS_PASSWORD || undefined, maxRetriesPerRequest: null as null };
const queue = new Queue("vehicle-scrape", { connection, defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } } });

type ScrapeJobData = { type: "scrape-all-sites"; siteKey?: string };

async function ensureSite(site: SiteConfig) {
  const [existing] = await db.select().from(schema.sites).where(eq(schema.sites.baseUrl, site.baseUrl)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(schema.sites).values({ name: site.name, baseUrl: site.baseUrl }).returning();
  if (!created) throw new Error(`could not create site ${site.name}`);
  return created;
}

async function saveItems(site: SiteConfig, items: ScrapedItem[]): Promise<void> {
  const databaseSite = await ensureSite(site);
  for (const item of items) {
    await db.insert(schema.scrapedItems).values({ siteId: databaseSite.id, title: item.title, price: item.price, year: item.year, mileage: item.mileage, city: item.city, listingUrl: item.listingUrl, thumbnailUrl: item.thumbnailUrl, rawData: item.rawData })
      .onConflictDoUpdate({ target: [schema.scrapedItems.siteId, schema.scrapedItems.listingUrl], set: { title: item.title, price: item.price, year: item.year, mileage: item.mileage, city: item.city, thumbnailUrl: item.thumbnailUrl, rawData: item.rawData, scrapedAt: new Date() } });
  }
}

async function scrapeAllSites(siteKey?: string): Promise<void> {
  if (!config.sites.length) { logger.warn("no sites configured; provide SCRAPER_SITES_JSON before enabling real scraping"); return; }
  const sites = siteKey ? config.sites.filter((site) => site.key === siteKey) : config.sites;
  if (siteKey && !sites.length) throw new Error(`site key is not configured: ${siteKey}`);
  const results = await Promise.allSettled(sites.map(async (site) => {
    const startedAt = Date.now();
    const items = await scrapeSite(site, { userAgent: config.SCRAPER_USER_AGENT, delayMs: site.delayMs, maxConcurrency: site.maxConcurrency, chromiumExecutablePath: config.CHROMIUM_EXECUTABLE_PATH });
    await saveItems(site, items);
    logger.info({ site: site.name, items: items.length, durationMs: Date.now() - startedAt }, "site scrape completed");
  }));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.error({ site: sites[index]?.name, err: result.reason }, "site scrape failed");
    }
  });
}

for (const site of config.sites) await ensureSite(site);
await queue.upsertJobScheduler("all-sites-schedule", { pattern: config.SCRAPE_CRON }, { name: "scrape-all-sites", data: { type: "scrape-all-sites" } });
const worker = new Worker<ScrapeJobData>("vehicle-scrape", async (job) => { await scrapeAllSites(job.data.siteKey); }, { connection, concurrency: 1 });
worker.on("completed", (job) => logger.info({ jobId: job.id, siteKey: job.data.siteKey ?? "all" }, "scrape job completed"));
worker.on("failed", (job, error) => logger.error({ jobId: job?.id, siteKey: job?.data.siteKey ?? "all", err: error }, "scrape job failed"));

await verifyDatabase();
await queue.waitUntilReady();
await worker.waitUntilReady();
await writeFile("/tmp/rta-worker-ready", "ready\n");
logger.info({ cron: config.SCRAPE_CRON, sites: config.sites.length, database: "connected", redis: "connected" }, "scraping worker started");

async function shutdown(): Promise<void> { await rm("/tmp/rta-worker-ready", { force: true }); await worker.close(); await queue.close(); await closeDatabase(); process.exit(0); }
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
