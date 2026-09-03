import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/client.js";
import { listings, sources, vehicles } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";

const querySchema = z.object({
  q: z.string().trim().max(100).optional(),
  make: z.string().trim().max(80).optional(),
  model: z.string().trim().max(100).optional(),
  minYear: z.coerce.number().int().min(1980).optional(),
  maxYear: z.coerce.number().int().max(new Date().getUTCFullYear() + 1).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  source: z.string().trim().max(50).optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "year_desc"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(48).default(12),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

const vehicleIdSchema = z.string().uuid();

export const catalogRouter = Router();

catalogRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = querySchema.parse(request.query);
    const conditions: SQL[] = [eq(listings.status, "active")];
    if (query.q) {
      const search = `%${query.q}%`;
      conditions.push(or(ilike(listings.title, search), ilike(vehicles.make, search), ilike(vehicles.model, search))!);
    }
    if (query.make) conditions.push(ilike(vehicles.make, query.make));
    if (query.model) conditions.push(ilike(vehicles.model, query.model));
    if (query.minYear) conditions.push(gte(vehicles.year, query.minYear));
    if (query.maxYear) conditions.push(lte(vehicles.year, query.maxYear));
    if (query.minPrice !== undefined) conditions.push(gte(listings.priceCents, query.minPrice * 100));
    if (query.maxPrice !== undefined) conditions.push(lte(listings.priceCents, query.maxPrice * 100));
    if (query.source) conditions.push(eq(sources.key, query.source));

    const order = {
      newest: desc(listings.lastSeenAt),
      price_asc: asc(listings.priceCents),
      price_desc: desc(listings.priceCents),
      year_desc: desc(vehicles.year),
    }[query.sort];

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
        .orderBy(order, desc(listings.id))
        .limit(query.limit)
        .offset(query.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(listings)
        .innerJoin(vehicles, eq(listings.vehicleId, vehicles.id))
        .innerJoin(sources, eq(listings.sourceId, sources.id))
        .where(where),
    ]);

    const total = countRows[0]?.count ?? 0;
    response.json({
      data: items,
      page: {
        limit: query.limit,
        offset: query.offset,
        total,
        hasNext: query.offset + items.length < total,
      },
    });
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
