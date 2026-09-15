import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireCsrf, requirePermission, requireRoles, requireSession } from "../../auth/session.js";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { scrapedItems, scrapingSites } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import { callScrapingApi, ScrapingApiTransportError, type ScrapingApiPayload } from "./scraping-client.js";

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

export const acquisitionRouter = Router();

// Serve source thumbnails through the API so browser hotlink/referrer rules do not
// turn a valid scraped image URL into a blank card. The target host is restricted
// to the configured inventory domains; this is not an open proxy.
acquisitionRouter.get(
  "/image",
  asyncHandler(async (request, response) => {
    const rawUrl = z.string().url().max(2_000).parse(request.query.url);
    const target = new URL(rawUrl);
    if (!/^https?:$/.test(target.protocol)) throw new AppError(400, "INVALID_IMAGE_URL", "Only HTTP image URLs are supported");

    const sites = await db.select({ baseUrl: scrapingSites.baseUrl }).from(scrapingSites);
    const targetHost = target.hostname.replace(/^www\./, "");
    const allowed = sites.some(({ baseUrl }) => {
      const sourceHost = new URL(baseUrl).hostname.replace(/^www\./, "");
      return targetHost === sourceHost || targetHost.endsWith(`.${sourceHost}`) || sourceHost.endsWith(`.${targetHost}`);
    });
    if (!allowed) throw new AppError(403, "IMAGE_HOST_NOT_ALLOWED", "This image host is not an approved inventory source");

    const origin = `${target.protocol}//${target.host}/`;
    const upstream = await fetch(target, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: origin,
        "User-Agent": "Mozilla/5.0 (compatible; RTA Inventory/1.0)",
      },
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
    if (!upstream?.ok) throw new AppError(404, "SOURCE_IMAGE_UNAVAILABLE", "The source image is no longer available");

    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0] ?? "";
    if (!contentType.startsWith("image/")) throw new AppError(415, "SOURCE_IMAGE_INVALID", "The source did not return an image");
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.byteLength > 10 * 1024 * 1024) throw new AppError(413, "SOURCE_IMAGE_TOO_LARGE", "The source image is too large");
    response.setHeader("Cache-Control", "public, max-age=3600");
    response.setHeader("Content-Type", contentType);
    response.send(body);
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
    const [items, totalRows, sites] = result;

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

function callScrapingApiForRoute(path: string, init: RequestInit = {}, options: { pathCategory: string; retryTransient?: boolean } = { pathCategory: "unknown" }): Promise<{ response: Response; payload: ScrapingApiPayload | null; attempt: number; elapsedMs: number }> {
  if (!env.SCRAPING_STACK_API_TOKEN) {
    throw new AppError(503, "SCRAPER_CREDENTIAL_NOT_CONFIGURED", "The scraping service credential is not configured");
  }
  const callOptions = { baseUrl: env.SCRAPING_STACK_API_URL, token: env.SCRAPING_STACK_API_TOKEN, path, init, pathCategory: options.pathCategory };
  return options.retryTransient === undefined ? callScrapingApi(callOptions) : callScrapingApi({ ...callOptions, retryTransient: options.retryTransient });
}

function warmingUpError(error: ScrapingApiTransportError): AppError {
  return new AppError(503, "SCRAPER_WARMING_UP", "Starting the scraping service. This can take up to a minute after inactivity.", { serviceStatus: "waking", pathCategory: error.pathCategory, attempt: error.attempt, elapsedMs: error.elapsedMs });
}

function upstreamError(code: string, message: string, response: Response, payload: ScrapingApiPayload | null): AppError {
  if (response.status === 401) return new AppError(502, "SCRAPER_CREDENTIAL_REJECTED", "The scraping service rejected its server credential. Check the Render token configuration.", { serviceStatus: "credential-rejected" });
  return new AppError(502, code, message, { serviceStatus: "upstream-error", upstreamStatus: response.status, upstreamMessage: payload?.error ?? null });
}

function ambiguousTriggerError(attempt: number, elapsedMs: number): AppError {
  return new AppError(503, "SCRAPER_TRIGGER_AMBIGUOUS", "The trigger outcome could not be confirmed. No second trigger was sent to prevent duplicate jobs.", { serviceStatus: "waking", attempt, elapsedMs });
}

acquisitionRouter.get(
  "/status",
  asyncHandler(async (_request, response) => {
    let result;
    try {
      result = await callScrapingApiForRoute("/api/scrape/status", {}, { pathCategory: "status", retryTransient: true });
    } catch (error) {
      if (error instanceof ScrapingApiTransportError) throw warmingUpError(error);
      throw error;
    }
    if (!result.response.ok) throw upstreamError("SCRAPER_STATUS_UPSTREAM_ERROR", "The scraping service returned a status error.", result.response, result.payload);
    if (!result.payload?.data) throw new AppError(502, "SCRAPER_STATUS_UPSTREAM_ERROR", "The scraping service returned an invalid status response.", { serviceStatus: "upstream-error", upstreamStatus: result.response.status });
    response.json({ data: { ...result.payload.data, serviceStatus: result.payload.data.activeJob ? "active" : "available" } });
  }),
);

acquisitionRouter.post(
  "/:siteId/trigger",
  requireRoles("admin", "operator", "recruiter"),
  requirePermission("scraping.jobs.trigger"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const siteId = z.coerce.number().int().positive().parse(request.params.siteId);
    const [site] = await db.select({ id: scrapingSites.id, name: scrapingSites.name, baseUrl: scrapingSites.baseUrl }).from(scrapingSites).where(eq(scrapingSites.id, siteId)).limit(1);
    if (!site) return response.status(404).json({ error: { code: "SCRAPER_SITE_NOT_FOUND", message: "Scraper site was not found" } });

    const siteKey = site.baseUrl.includes("pakwheels.com") ? "pakwheels" : site.baseUrl.includes("olx.com.pk") ? "olx-pakistan" : null;
    if (!siteKey) return response.status(422).json({ error: { code: "SCRAPER_SITE_NOT_TRIGGERABLE", message: `${site.name} has no live scraper trigger configured` } });
    let warmup;
    try {
      warmup = await callScrapingApiForRoute("/health", {}, { pathCategory: "health", retryTransient: true });
    } catch (error) {
      if (error instanceof ScrapingApiTransportError) throw warmingUpError(error);
      throw error;
    }
    if (!warmup.response.ok) throw upstreamError("SCRAPER_WARMUP_UPSTREAM_ERROR", "The scraping service returned a health-check error.", warmup.response, warmup.payload);

    let triggerResult;
    try {
      triggerResult = await callScrapingApiForRoute(`/api/scrape/${siteKey}`, { method: "POST" }, { pathCategory: "trigger" });
    } catch (error) {
      if (!(error instanceof ScrapingApiTransportError)) throw error;
      let confirmation;
      try {
        confirmation = await callScrapingApiForRoute("/api/scrape/status", {}, { pathCategory: "trigger-confirmation", retryTransient: true });
      } catch (confirmationError) {
        if (confirmationError instanceof ScrapingApiTransportError) throw ambiguousTriggerError(confirmationError.attempt, confirmationError.elapsedMs);
        throw confirmationError;
      }
      if (!confirmation.response.ok) throw upstreamError("SCRAPER_TRIGGER_CONFIRMATION_FAILED", "The trigger outcome could not be confirmed.", confirmation.response, confirmation.payload);
      if (confirmation.payload?.data?.activeJob) {
        throw new AppError(409, "SCRAPER_ALREADY_RUNNING", "The scrape request was accepted and is already running.", { activeJob: confirmation.payload.data.activeJob });
      }
      throw ambiguousTriggerError(error.attempt, error.elapsedMs);
    }
    const { response: upstream, payload } = triggerResult;
    if (!upstream.ok) {
      if (upstream.status === 409) {
        throw new AppError(409, "SCRAPER_ALREADY_RUNNING", "A scrape is already queued or processing. Please wait until it finishes.", payload?.data?.activeJob ?? null);
      }
      if (upstream.status === 429) {
        const retryAfter = payload?.data?.retryAfterSeconds;
        throw new AppError(429, "SCRAPER_RATE_LIMITED", retryAfter ? `Scraping was recently started. Try again in about ${retryAfter} seconds.` : "Scraping was recently started. Please wait before trying again.", { retryAfterSeconds: retryAfter ?? null });
      }
      if (upstream.status === 401) {
        throw new AppError(502, "SCRAPER_CREDENTIAL_REJECTED", "The scraping service rejected its server credential. Check the Render token configuration.");
      }
      if (upstream.status === 404) {
        throw new AppError(502, "SCRAPER_SITE_NOT_CONFIGURED", `${site.name} is not configured in the scraping service.`);
      }
      throw new AppError(502, "SCRAPER_TRIGGER_FAILED", payload?.error ?? "The scraping service could not start this scrape");
    }
    response.status(202).json({ data: { siteId: site.id, siteName: site.name, siteKey, jobId: payload?.data?.jobId ?? null, status: "queued" } });
  }),
);
