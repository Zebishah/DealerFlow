import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { Router } from "express";
import { z } from "zod";
import { requireCsrf, requirePermission, requireRoles, requireSession } from "../../auth/session.js";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { scrapeActorRuns, scrapedItems, scrapingSites } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { ApifyClientError, mapApifyStatus, requireApifyClient, type ApifyRun } from "./apify-client.js";
import { APPROVED_APIFY_SITE_KEYS, apifySiteKeyForBaseUrl, sourceExecutionMetadata, type ApifySiteKey } from "./source-mapping.js";
import { fetchApprovedSourceImage } from "./image-proxy.js";

function isTransientDatabaseError(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string; message?: string } };
  const text = `${candidate.code ?? ""} ${candidate.cause?.code ?? ""} ${candidate.cause?.message ?? ""} ${error instanceof Error ? `${error.message} ${error.stack ?? ""}` : ""}`;
  return /ETIMEDOUT|ECONNRESET|ENETUNREACH|EAI_AGAIN|ECONNREFUSED/.test(text);
}

async function retryTransientDatabase<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  siteId: z.coerce.number().int().positive().optional(),
  minYear: z.coerce.number().int().min(1980).optional(),
  maxYear: z.coerce.number().int().max(new Date().getUTCFullYear() + 1).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  maxMileage: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

const publicInventoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  siteKey: z.enum(APPROVED_APIFY_SITE_KEYS as [ApifySiteKey, ...ApifySiteKey[]]).optional(),
  minYear: z.coerce.number().int().min(1980).optional(),
  maxYear: z.coerce.number().int().max(new Date().getUTCFullYear() + 1).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  maxMileage: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
}).strict();

export const acquisitionRouter = Router();

// Serve source thumbnails through the API so browser hotlink/referrer rules do not
// turn a valid scraped image URL into a blank card. The target host is restricted
// to the explicit approved source/CDN map; this is not an open proxy.
acquisitionRouter.get(
  "/image",
  asyncHandler(async (request, response) => {
    const rawUrl = z.string().url().max(2_000).parse(request.query.url);
    const upstream = await fetchApprovedSourceImage(rawUrl);

    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0] ?? "";
    if (!contentType.startsWith("image/")) throw new AppError(415, "SOURCE_IMAGE_INVALID", "The source did not return an image");
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.byteLength > 10 * 1024 * 1024) throw new AppError(413, "SOURCE_IMAGE_TOO_LARGE", "The source image is too large");
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.setHeader("Content-Type", contentType);
    response.send(body);
  }),
);

// Public browsing is intentionally limited to the three live Apify sources and
// a public-safe listing projection. Workspace actions remain behind the session
// middleware below.
acquisitionRouter.get(
  "/public",
  asyncHandler(async (request, response) => {
    const query = publicInventoryQuerySchema.parse(request.query);
    const siteRows = await db.select({ id: scrapingSites.id, name: scrapingSites.name, baseUrl: scrapingSites.baseUrl })
      .from(scrapingSites)
      .orderBy(scrapingSites.id);
    const liveSites = siteRows
      .map((site) => ({ ...site, siteKey: apifySiteKeyForBaseUrl(site.baseUrl) }))
      .filter((site): site is typeof site & { siteKey: ApifySiteKey } => site.siteKey !== null);
    const selectedSites = query.siteKey
      ? liveSites.filter((site) => site.siteKey === query.siteKey)
      : liveSites;
    const sources = liveSites.map(({ id, name, siteKey }) => ({ id, name, siteKey }));
    const siteIds = selectedSites.map((site) => site.id);

    if (siteIds.length === 0) {
      return response.json({ data: { items: [], sources }, page: { limit: query.limit, offset: query.offset, total: 0, hasMore: false } });
    }

    const conditions: SQL[] = [inArray(scrapedItems.siteId, siteIds)];
    if (query.q) {
      const search = `%${query.q}%`;
      conditions.push(or(ilike(scrapedItems.title, search), ilike(scrapedItems.city, search))!);
    }
    const listedYear = sql`NULLIF(substring(${scrapedItems.year} from '[0-9]{4}'), '')::int`;
    const listedPrice = sql`NULLIF(replace(substring(${scrapedItems.price} from '[0-9][0-9,.]*'), ',', ''), '')::numeric`;
    const listedMileage = sql`NULLIF(replace(substring(${scrapedItems.mileage} from '[0-9][0-9,.]*'), ',', ''), '')::numeric`;
    if (query.minYear) conditions.push(sql`${listedYear} >= ${query.minYear}`);
    if (query.maxYear) conditions.push(sql`${listedYear} <= ${query.maxYear}`);
    if (query.minPrice !== undefined) conditions.push(sql`${listedPrice} >= ${query.minPrice}`);
    if (query.maxPrice !== undefined) conditions.push(sql`${listedPrice} <= ${query.maxPrice}`);
    if (query.maxMileage !== undefined) conditions.push(sql`${listedMileage} <= ${query.maxMileage}`);
    const where = and(...conditions);
    const [items, totalRows] = await Promise.all([
      db.select({
        id: scrapedItems.id,
        siteId: scrapedItems.siteId,
        siteName: scrapingSites.name,
        title: scrapedItems.title,
        price: scrapedItems.price,
        year: scrapedItems.year,
        mileage: scrapedItems.mileage,
        city: scrapedItems.city,
        listingUrl: scrapedItems.listingUrl,
        thumbnailUrl: scrapedItems.thumbnailUrl,
        scrapedAt: scrapedItems.scrapedAt,
      })
        .from(scrapedItems)
        .innerJoin(scrapingSites, eq(scrapedItems.siteId, scrapingSites.id))
        .where(where)
        .orderBy(desc(scrapedItems.scrapedAt), desc(scrapedItems.id))
        .limit(query.limit)
        .offset(query.offset),
      db.select({ count: count(scrapedItems.id) })
        .from(scrapedItems)
        .where(where),
    ]);
    const total = Number(totalRows[0]?.count ?? 0);
    response.json({ data: { items, sources }, page: { limit: query.limit, offset: query.offset, total, hasMore: query.offset + items.length < total } });
  }),
);

// Inventory is read-only for authenticated workspace roles; live triggers remain operator-only below.
acquisitionRouter.use(requireSession, requireRoles("admin", "operator", "employee", "virtual_assistant", "recruiter", "viewer"));

acquisitionRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = querySchema.parse(request.query);
    const conditions: SQL[] = [];
    if (query.q) {
      const search = `%${query.q}%`;
      conditions.push(or(ilike(scrapedItems.title, search), ilike(scrapedItems.city, search))!);
    }
    if (query.siteId) conditions.push(eq(scrapedItems.siteId, query.siteId));
    if (query.minYear) conditions.push(sql`NULLIF(regexp_replace(${scrapedItems.year}, '[^0-9]', '', 'g'), '')::int >= ${query.minYear}`);
    if (query.maxYear) conditions.push(sql`NULLIF(regexp_replace(${scrapedItems.year}, '[^0-9]', '', 'g'), '')::int <= ${query.maxYear}`);
    if (query.maxPrice !== undefined) conditions.push(sql`NULLIF(regexp_replace(${scrapedItems.price}, '[^0-9.]', '', 'g'), '')::numeric <= ${query.maxPrice}`);
    if (query.maxMileage !== undefined) conditions.push(sql`NULLIF(regexp_replace(${scrapedItems.mileage}, '[^0-9.]', '', 'g'), '')::numeric <= ${query.maxMileage}`);

    const where = conditions.length ? and(...conditions) : undefined;
    let result: Awaited<ReturnType<typeof loadScrapingResults>>;
    try {
      result = await retryTransientDatabase(() => loadScrapingResults(where, query.limit, query.offset));
    } catch (error) {
      if (isTransientDatabaseError(error)) {
        throw new AppError(503, "SCRAPING_RESULTS_DATABASE_UNAVAILABLE", "Neon database is temporarily unreachable. Please retry in a few seconds.");
      }
      throw error;
    }
    const [items, totalRows, siteRows] = result;
    const sites = siteRows.map((site) => ({ ...site, ...sourceExecutionMetadata(site.baseUrl) }));

    response.json({ data: { items, sites }, page: { limit: query.limit, offset: query.offset, total: totalRows[0]?.count ?? 0, hasMore: query.offset + items.length < Number(totalRows[0]?.count ?? 0) } });
  }),
);

function loadScrapingResults(where: SQL | undefined, limit: number, offset: number) {
  return Promise.all([
    db.select({
      id: scrapedItems.id,
      siteId: scrapedItems.siteId,
      siteName: scrapingSites.name,
      title: scrapedItems.title,
      price: scrapedItems.price,
      year: scrapedItems.year,
      mileage: scrapedItems.mileage,
      city: scrapedItems.city,
      listingUrl: scrapedItems.listingUrl,
      thumbnailUrl: scrapedItems.thumbnailUrl,
      scrapedAt: scrapedItems.scrapedAt,
    })
      .from(scrapedItems)
      .innerJoin(scrapingSites, eq(scrapedItems.siteId, scrapingSites.id))
      .where(where)
      .orderBy(desc(scrapedItems.scrapedAt), desc(scrapedItems.id))
      .limit(limit)
      .offset(offset),
    db.select({ count: count(scrapedItems.id) })
      .from(scrapedItems)
      .where(where),
    db.select({
      id: scrapingSites.id,
      name: scrapingSites.name,
      baseUrl: scrapingSites.baseUrl,
      itemCount: count(scrapedItems.id),
      lastScrapedAt: sql<Date | null>`max(${scrapedItems.scrapedAt})`,
    })
      .from(scrapingSites)
      .leftJoin(scrapedItems, eq(scrapedItems.siteId, scrapingSites.id))
      .groupBy(scrapingSites.id)
      .orderBy(scrapingSites.id),
  ]);
}

const triggerBodySchema = z.object({ limit: z.coerce.number().int().min(1).max(10).optional(), siteKey: z.string().optional() }).strict();
const terminalActorStatuses = ["completed", "failed", "cancelled"] as const;

function apifyErrorToAppError(error: ApifyClientError): AppError {
  if (error.kind === "credentials") return new AppError(502, "SCRAPER_CREDENTIAL_REJECTED", "The Apify integration rejected its server credential.", { serviceStatus: "credential-rejected" });
  if (error.kind === "not-found") return new AppError(502, "SCRAPER_ACTOR_NOT_FOUND", "The configured Apify Actor or run was not found.", { serviceStatus: "upstream-error" });
  if (error.kind === "rate-limited") return new AppError(429, "SCRAPER_RATE_LIMITED", "Apify is rate limiting scrape requests. Please try again shortly.", { serviceStatus: "upstream-error" });
  if (error.kind === "malformed") return new AppError(502, "SCRAPER_UPSTREAM_INVALID_RESPONSE", "Apify returned an invalid response.", { serviceStatus: "upstream-error" });
  return new AppError(503, "SCRAPER_UPSTREAM_UNAVAILABLE", "The Apify scraping service is temporarily unavailable.", { serviceStatus: "upstream-error" });
}

function safeRunError(run: ApifyRun): string | null {
  const status = mapApifyStatus(run.status);
  return status === "failed" ? "The Apify Actor run failed." : null;
}

function publicActorRun(row: typeof scrapeActorRuns.$inferSelect) {
  return {
    jobId: row.apifyRunId,
    runId: row.apifyRunId,
    siteKey: row.siteKey,
    status: row.status as "queued" | "scraping" | "completed" | "failed" | "cancelled",
    progressStage: row.progressStage,
    limit: row.requestedLimit,
    requestedCount: row.requestedLimit,
    foundCount: row.foundCount,
    startedAt: row.startedAt?.toISOString() ?? null,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    durationMs: row.durationMs,
    failedReason: row.lastError,
  };
}

async function reconcileActorRun(row: typeof scrapeActorRuns.$inferSelect): Promise<typeof scrapeActorRuns.$inferSelect> {
  if (terminalActorStatuses.includes(row.status as (typeof terminalActorStatuses)[number])) return row;
  const key = row.siteKey as ApifySiteKey;
  const client = requireApifyClient();
  const remote = await client.getRun(row.apifyRunId, key);
  const status = mapApifyStatus(remote.status);
  const finishedAt = status === "completed" || status === "failed" || status === "cancelled" ? (remote.finishedAt ? new Date(remote.finishedAt) : new Date()) : null;
  let output: Awaited<ReturnType<typeof client.getOutput>> | undefined;
  if (status === "completed") {
    try {
      output = await client.getOutput(remote, key);
    } catch (error) {
      logger.warn({ siteKey: key, runId: row.apifyRunId, errorKind: error instanceof ApifyClientError ? error.kind : "unknown" }, "Apify run completed but output metadata was unavailable");
    }
  }
  const startedAt = remote.startedAt ? new Date(remote.startedAt) : row.startedAt;
  const durationMs = output?.durationMs ?? (finishedAt && startedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : row.durationMs);
  const [updated] = await db.update(scrapeActorRuns).set({
    status,
    foundCount: output?.foundCount ?? row.foundCount,
    durationMs,
    timings: output?.timings ?? row.timings,
    startedAt,
    finishedAt,
    lastError: safeRunError(remote),
    updatedAt: new Date(),
  }).where(eq(scrapeActorRuns.id, row.id)).returning();
  if (!updated) throw new Error("Apify run reconciliation failed");
  return updated;
}

acquisitionRouter.get(
  "/status",
  asyncHandler(async (_request, response) => {
    const [row] = await db.select().from(scrapeActorRuns).orderBy(desc(scrapeActorRuns.createdAt)).limit(1);
    if (!row) return response.json({ data: { serviceStatus: "available", activeJob: null, defaultLimit: env.APIFY_DEFAULT_SCRAPE_LIMIT, maxLimit: env.APIFY_MAX_SCRAPE_LIMIT } });
    let current: typeof row;
    try {
      current = await reconcileActorRun(row);
    } catch (error) {
      if (error instanceof ApifyClientError) throw apifyErrorToAppError(error);
      throw error;
    }
    const active = !terminalActorStatuses.includes(current.status as (typeof terminalActorStatuses)[number]);
    response.json({ data: { serviceStatus: active ? "active" : "available", activeJob: publicActorRun(current), defaultLimit: env.APIFY_DEFAULT_SCRAPE_LIMIT, maxLimit: env.APIFY_MAX_SCRAPE_LIMIT } });
  }),
);

acquisitionRouter.post(
  "/:siteId/trigger",
  rateLimit({ windowMs: env.SCRAPE_RATE_LIMIT_WINDOW_MS, limit: env.SCRAPE_RATE_LIMIT_MAX, standardHeaders: "draft-8", legacyHeaders: false, keyGenerator: (request) => request.user?.id ?? ipKeyGenerator(request.ip ?? "unknown"), handler: (_request, response) => response.status(429).json({ error: { code: "SCRAPER_RATE_LIMITED", message: "Scraping was recently started. Please wait before trying again." } }) }),
  requireRoles("admin", "operator", "recruiter"),
  requirePermission("scraping.jobs.trigger"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const siteId = z.coerce.number().int().positive().parse(request.params.siteId);
    const [site] = await db.select({ id: scrapingSites.id, name: scrapingSites.name, baseUrl: scrapingSites.baseUrl }).from(scrapingSites).where(eq(scrapingSites.id, siteId)).limit(1);
    if (!site) return response.status(404).json({ error: { code: "SCRAPER_SITE_NOT_FOUND", message: "Scraper site was not found" } });
    const siteKey = apifySiteKeyForBaseUrl(site.baseUrl);
    if (!siteKey) return response.status(422).json({ error: { code: "SCRAPER_SITE_NOT_TRIGGERABLE", message: `${site.name} is a reference or legacy source and cannot be run from this dashboard` } });
    const body = triggerBodySchema.parse(request.body ?? {});
    if (body.siteKey && body.siteKey !== siteKey) throw new AppError(400, "SCRAPER_SITE_KEY_MISMATCH", "The requested site key does not match the selected source");
    const limit = body.limit ?? env.APIFY_DEFAULT_SCRAPE_LIMIT;
    if (limit > env.APIFY_MAX_SCRAPE_LIMIT) throw new AppError(400, "SCRAPER_LIMIT_INVALID", `limit cannot exceed ${env.APIFY_MAX_SCRAPE_LIMIT}`);
    const client = requireApifyClient();
    let created: typeof scrapeActorRuns.$inferSelect;
    try {
      created = await db.transaction(async (transaction) => {
        await transaction.execute(sql`select pg_advisory_xact_lock(hashtext('rta:apify:single-active-run'))`);
        const [active] = await transaction.select().from(scrapeActorRuns).where(inArray(scrapeActorRuns.status, ["queued", "scraping"])).orderBy(desc(scrapeActorRuns.createdAt)).limit(1);
        if (active) throw new AppError(409, "SCRAPER_ALREADY_RUNNING", "A scrape is already queued or processing.", { activeJob: publicActorRun(active) });
        const remote = await client.startRun(siteKey, limit);
        const [row] = await transaction.insert(scrapeActorRuns).values({
          apifyRunId: remote.id,
          siteId: site.id,
          siteKey,
          requestedLimit: limit,
          status: mapApifyStatus(remote.status),
          startedAt: remote.startedAt ? new Date(remote.startedAt) : null,
          updatedAt: new Date(),
        }).returning();
        if (!row) throw new Error("Failed to persist Apify run metadata");
        return row;
      });
    } catch (error) {
      if (error instanceof ApifyClientError) throw apifyErrorToAppError(error);
      throw error;
    }
    response.status(202).json({ data: { siteId: site.id, siteName: site.name, siteKey, jobId: created.apifyRunId, runId: created.apifyRunId, status: "queued" } });
  }),
);
