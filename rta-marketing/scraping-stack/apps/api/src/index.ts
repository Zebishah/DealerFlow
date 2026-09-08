import express from "express";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { count, desc, eq, max } from "drizzle-orm";
import { db, schema, verifyDatabase } from "@rta/db";
import { createRedisConnectionConfig, loadConfig, logger } from "@rta/shared";

const config = loadConfig();
const connection = createRedisConnectionConfig(config);
const redis = new Redis({ ...connection, lazyConnect: true });
const scrapeQueue = new Queue("vehicle-scrape", {
  connection,
});
const manualScrapeCooldown = new Map<string, number>();
const app = express();
app.use(express.json({ limit: "64kb" }));
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

app.post("/api/scrape/:siteKey", async (request, response) => {
  const siteKey = request.params.siteKey;
  const site = config.sites.find((configuredSite) => configuredSite.key === siteKey);
  if (!site) return response.status(404).json({ error: "site is not configured" });

  const availableAt = manualScrapeCooldown.get(siteKey) ?? 0;
  if (Date.now() < availableAt) {
    return response.status(429).json({ error: "site was triggered recently", retryAfterSeconds: Math.ceil((availableAt - Date.now()) / 1000) });
  }

  const job = await scrapeQueue.add(
    `manual-${siteKey}-${Date.now()}`,
    { type: "scrape-all-sites", siteKey },
    { attempts: 1, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
  );
  manualScrapeCooldown.set(siteKey, Date.now() + 15_000);
  response.status(202).json({ data: { jobId: job.id, siteKey, status: "queued" } });
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
