import { and, asc, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireCsrf, requireSession, requireWorkspaceForRoles } from "../../auth/session.js";
import { db } from "../../db/client.js";
import { listings, savedScrapedItems, savedVehicles, scrapedItems, scrapingSites, sources, vehicles } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";

const uuidSchema = z.string().uuid();

export const savedRouter = Router();
savedRouter.use(requireSession);
savedRouter.use(requireWorkspaceForRoles("admin", "employee", "virtual_assistant", "recruiter", "viewer"));

savedRouter.get(
  "/scraped",
  asyncHandler(async (request, response) => {
    const rows = await db
      .select({
        savedId: savedScrapedItems.id,
        savedAt: savedScrapedItems.createdAt,
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
      .from(savedScrapedItems)
      .innerJoin(scrapedItems, eq(savedScrapedItems.scrapedItemId, scrapedItems.id))
      .innerJoin(scrapingSites, eq(scrapedItems.siteId, scrapingSites.id))
      .where(eq(savedScrapedItems.userId, request.user!.id))
      .orderBy(desc(savedScrapedItems.createdAt));

    response.json({ data: rows });
  }),
);

savedRouter.post(
  "/scraped/:scrapedItemId",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const scrapedItemId = z.coerce.number().int().positive().parse(request.params.scrapedItemId);
    const [item] = await db.select({ id: scrapedItems.id }).from(scrapedItems).where(eq(scrapedItems.id, scrapedItemId)).limit(1);
    if (!item) throw new AppError(404, "SCRAPED_ITEM_NOT_FOUND", "The scraped vehicle was not found");

    const [saved] = await db
      .insert(savedScrapedItems)
      .values({ userId: request.user!.id, scrapedItemId })
      .onConflictDoNothing()
      .returning({ id: savedScrapedItems.id, createdAt: savedScrapedItems.createdAt });
    response.status(saved ? 201 : 200).json({ data: saved ?? { alreadySaved: true } });
  }),
);

savedRouter.delete(
  "/scraped/:scrapedItemId",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const scrapedItemId = z.coerce.number().int().positive().parse(request.params.scrapedItemId);
    await db.delete(savedScrapedItems).where(and(eq(savedScrapedItems.scrapedItemId, scrapedItemId), eq(savedScrapedItems.userId, request.user!.id)));
    response.status(204).send();
  }),
);

savedRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const ownership = eq(savedVehicles.userId, request.user!.id);

    const rows = await db
      .selectDistinctOn([vehicles.id], {
        savedId: savedVehicles.id,
        savedAt: savedVehicles.createdAt,
        vehicleId: vehicles.id,
        listingId: listings.id,
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
      .from(savedVehicles)
      .innerJoin(vehicles, eq(savedVehicles.vehicleId, vehicles.id))
      .innerJoin(listings, eq(listings.vehicleId, vehicles.id))
      .innerJoin(sources, eq(listings.sourceId, sources.id))
      .where(and(ownership, eq(listings.status, "active")))
      .orderBy(vehicles.id, asc(listings.priceCents), desc(listings.lastSeenAt));

    response.json({ data: rows.sort((left, right) => right.savedAt.getTime() - left.savedAt.getTime()) });
  }),
);

savedRouter.post(
  "/:vehicleId",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const vehicleId = uuidSchema.parse(request.params.vehicleId);
    const exists = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (!exists[0]) throw new AppError(404, "VEHICLE_NOT_FOUND", "Vehicle was not found");

    const [saved] = await db
      .insert(savedVehicles)
      .values({ vehicleId, userId: request.user!.id, demoSessionId: null })
      .onConflictDoNothing()
      .returning({ id: savedVehicles.id, createdAt: savedVehicles.createdAt });
    response.status(saved ? 201 : 200).json({ data: saved ?? { alreadySaved: true } });
  }),
);

savedRouter.delete(
  "/:vehicleId",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const vehicleId = uuidSchema.parse(request.params.vehicleId);
    const ownership = eq(savedVehicles.userId, request.user!.id);
    await db.delete(savedVehicles).where(and(eq(savedVehicles.vehicleId, vehicleId), ownership));
    response.status(204).send();
  }),
);
