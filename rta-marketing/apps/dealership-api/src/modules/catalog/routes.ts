import { and, asc, desc, eq, gte, gt, ilike, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireSession, requireWorkspaceForRoles } from "../../auth/session.js";
import { db } from "../../db/client.js";
import { listings, sources, vehicles } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import { cacheAside, cacheScope } from "../../infra/cache.js";

const sortSchema = z.enum(["newest", "price_asc", "price_desc", "year_desc"]);
const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  make: z.string().trim().max(80).optional(),
  model: z.string().trim().max(100).optional(),
  minYear: z.coerce.number().int().min(1980).optional(),
  maxYear: z.coerce.number().int().max(new Date().getUTCFullYear() + 1).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  source: z.string().trim().max(50).optional(),
  sort: sortSchema.default("newest"),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  cursor: z.string().max(500).optional(),
});

const vehicleIdSchema = z.string().uuid();
const cursorSchema = z.object({
  sort: sortSchema,
  key: z.union([z.number(), z.string()]),
  id: z.string().uuid(),
});

type CatalogCursor = z.infer<typeof cursorSchema>;

function encodeCursor(cursor: CatalogCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string | undefined): CatalogCursor | undefined {
  if (!value) return undefined;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "The catalog pagination cursor is invalid");
  }
}

export const catalogRouter = Router();
catalogRouter.use(requireSession);
catalogRouter.use(requireWorkspaceForRoles("admin", "employee", "virtual_assistant", "recruiter", "viewer"));

catalogRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = querySchema.parse(request.query);
    const cursor = decodeCursor(query.cursor);
    if (cursor && cursor.sort !== query.sort) {
      throw new AppError(400, "INVALID_CURSOR", "The catalog cursor does not match the requested sort");
    }
    const baseConditions: SQL[] = [eq(listings.status, "active")];
    if (query.q) {
      const search = `%${query.q}%`;
      baseConditions.push(or(ilike(listings.title, search), ilike(vehicles.make, search), ilike(vehicles.model, search))!);
    }
    if (query.make) baseConditions.push(ilike(vehicles.make, query.make));
    if (query.model) baseConditions.push(ilike(vehicles.model, query.model));
    if (query.minYear) baseConditions.push(gte(vehicles.year, query.minYear));
    if (query.maxYear) baseConditions.push(lte(vehicles.year, query.maxYear));
    if (query.minPrice !== undefined) baseConditions.push(gte(listings.priceCents, query.minPrice * 100));
    if (query.maxPrice !== undefined) baseConditions.push(lte(listings.priceCents, query.maxPrice * 100));
    if (query.source) baseConditions.push(eq(sources.key, query.source));

    const conditions = [...baseConditions];

    const priceAscendingKey = sql<number>`coalesce(${listings.priceCents}, 2147483647)`;
    const priceDescendingKey = sql<number>`coalesce(${listings.priceCents}, -1)`;
    const sortKey = {
      newest: listings.lastSeenAt,
      price_asc: priceAscendingKey,
      price_desc: priceDescendingKey,
      year_desc: vehicles.year,
    }[query.sort];
    const descending = query.sort === "newest" || query.sort === "price_desc" || query.sort === "year_desc";
    const order = descending ? desc(sortKey) : asc(sortKey);

    if (cursor) {
      if (query.sort === "newest") {
        const key = new Date(String(cursor.key));
        if (Number.isNaN(key.getTime())) {
          throw new AppError(400, "INVALID_CURSOR", "The catalog pagination cursor is invalid");
        }
        conditions.push(
          or(
            lt(listings.lastSeenAt, key),
            and(eq(listings.lastSeenAt, key), lt(listings.id, cursor.id)),
          )!,
        );
      } else if (query.sort === "price_asc") {
        const key = Number(cursor.key);
        if (!Number.isFinite(key)) throw new AppError(400, "INVALID_CURSOR", "The catalog pagination cursor is invalid");
        conditions.push(
          or(gt(priceAscendingKey, key), and(eq(priceAscendingKey, key), gt(listings.id, cursor.id)))!,
        );
      } else if (query.sort === "price_desc") {
        const key = Number(cursor.key);
        if (!Number.isFinite(key)) throw new AppError(400, "INVALID_CURSOR", "The catalog pagination cursor is invalid");
        conditions.push(
          or(lt(priceDescendingKey, key), and(eq(priceDescendingKey, key), lt(listings.id, cursor.id)))!,
        );
      } else {
        const key = Number(cursor.key);
        if (!Number.isInteger(key)) throw new AppError(400, "INVALID_CURSOR", "The catalog pagination cursor is invalid");
        conditions.push(
          or(lt(vehicles.year, key), and(eq(vehicles.year, key), lt(listings.id, cursor.id)))!,
        );
      }
    }

    const payload = await cacheAside({
      namespace: "catalog",
      scope: cacheScope(request.user?.workspaceId, request.user?.role ?? "unknown"),
      filters: { ...query, cursor: cursor ?? null },
      ttlSeconds: 30,
      load: async () => {
        const where = and(...conditions);
        const [items, countRows] = await Promise.all([
          db
            .select({
              listingId: listings.id,
              vehicleId: vehicles.id,
              externalId: listings.externalId,
              source: sources.key,
              sourceName: sources.name,
              title: listings.title,
              url: listings.url,
              make: vehicles.make,
              model: vehicles.model,
              trim: vehicles.trim,
              year: vehicles.year,
              priceCents: listings.priceCents,
              currency: listings.currency,
              odometerKm: listings.odometerKm,
              imageUrl: listings.imageUrl,
              dealerName: listings.dealerName,
              location: listings.location,
              isUsed: vehicles.isUsed,
              lastSeenAt: listings.lastSeenAt,
            })
            .from(listings)
            .innerJoin(vehicles, eq(listings.vehicleId, vehicles.id))
            .innerJoin(sources, eq(listings.sourceId, sources.id))
            .where(where)
            .orderBy(order, descending ? desc(listings.id) : asc(listings.id))
            .limit(query.limit + 1),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(listings)
            .innerJoin(vehicles, eq(listings.vehicleId, vehicles.id))
            .innerJoin(sources, eq(listings.sourceId, sources.id))
            .where(and(...baseConditions)),
        ]);

        const hasNext = items.length > query.limit;
        const pageItems = items.slice(0, query.limit);
        const last = pageItems.at(-1);
        const nextCursor = hasNext && last
          ? encodeCursor({
            sort: query.sort,
            key: query.sort === "newest"
              ? last.lastSeenAt.toISOString()
              : query.sort === "price_asc"
                ? last.priceCents ?? 2147483647
                : query.sort === "price_desc"
                  ? last.priceCents ?? -1
                  : last.year,
            id: last.listingId,
          })
          : null;
        const total = countRows[0]?.count ?? 0;
        return { data: pageItems, page: { limit: query.limit, total, hasNext, nextCursor } };
      },
    });
    response.json(payload);
  }),
);

catalogRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const id = vehicleIdSchema.parse(request.params.id);
    const vehicleRows = await db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    const vehicle = vehicleRows[0];
    if (!vehicle) throw new AppError(404, "VEHICLE_NOT_FOUND", "Vehicle was not found");

    const offers = await db
      .select({
        id: listings.id,
        source: sources.key,
        sourceName: sources.name,
        externalId: listings.externalId,
        title: listings.title,
        url: listings.url,
        imageUrl: listings.imageUrl,
        priceCents: listings.priceCents,
        currency: listings.currency,
        odometerKm: listings.odometerKm,
        dealerName: listings.dealerName,
        location: listings.location,
        firstSeenAt: listings.firstSeenAt,
        lastSeenAt: listings.lastSeenAt,
      })
      .from(listings)
      .innerJoin(sources, eq(listings.sourceId, sources.id))
      .where(and(eq(listings.vehicleId, id), eq(listings.status, "active")))
      .orderBy(asc(listings.priceCents));

    response.json({ data: { ...vehicle, offers } });
  }),
);
