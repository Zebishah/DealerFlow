import { and, desc, eq } from "drizzle-orm";
import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../../db/client.js";
import { listings, savedVehicles, sources, vehicles } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";

const uuidSchema = z.string().uuid();

function owner(request: Request) {
  if (request.user) return { userId: request.user.id, demoSessionId: null };
  const header = request.header("x-demo-session-id");
  if (!header) {
    throw new AppError(400, "DEMO_SESSION_REQUIRED", "A demo session ID is required");
  }
  return { userId: null, demoSessionId: uuidSchema.parse(header) };
}

export const savedRouter = Router();

savedRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const identity = owner(request);
    const ownership = identity.userId
      ? eq(savedVehicles.userId, identity.userId)
      : eq(savedVehicles.demoSessionId, identity.demoSessionId!);

    const rows = await db
      .select({
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
      })
      .from(savedVehicles)
      .innerJoin(vehicles, eq(savedVehicles.vehicleId, vehicles.id))
      .innerJoin(listings, eq(listings.vehicleId, vehicles.id))
      .innerJoin(sources, eq(listings.sourceId, sources.id))
      .where(and(ownership, eq(listings.status, "active")))
      .orderBy(desc(savedVehicles.createdAt));

    response.json({ data: rows });
  }),
);

savedRouter.post(
  "/:vehicleId",
  asyncHandler(async (request, response) => {
    const identity = owner(request);
    const vehicleId = uuidSchema.parse(request.params.vehicleId);
    const exists = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
    if (!exists[0]) throw new AppError(404, "VEHICLE_NOT_FOUND", "Vehicle was not found");

    const [saved] = await db
      .insert(savedVehicles)
      .values({ vehicleId, ...identity })
      .onConflictDoNothing()
      .returning({ id: savedVehicles.id, createdAt: savedVehicles.createdAt });
    response.status(saved ? 201 : 200).json({ data: saved ?? { alreadySaved: true } });
  }),
);

savedRouter.delete(
  "/:vehicleId",
  asyncHandler(async (request, response) => {
    const identity = owner(request);
    const vehicleId = uuidSchema.parse(request.params.vehicleId);
    const ownership = identity.userId
      ? eq(savedVehicles.userId, identity.userId)
      : eq(savedVehicles.demoSessionId, identity.demoSessionId!);
    await db.delete(savedVehicles).where(and(eq(savedVehicles.vehicleId, vehicleId), ownership));
    response.status(204).send();
  }),
);
