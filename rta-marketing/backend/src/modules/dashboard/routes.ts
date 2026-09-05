import { desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { requireSession } from "../../auth/session.js";
import { db } from "../../db/client.js";
import { listings, scrapeRuns, sourceRuns, sources, vehicles } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { getRunSummary } from "../runs/run.service.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireSession);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (_request, response) => {
    const [runSummary, catalogRows, sourceHealth, recentRuns] = await Promise.all([
      getRunSummary(),
      db
        .select({
          activeListings: sql<number>`count(${listings.id}) filter (where ${listings.status} = 'active')::int`,
          canonicalVehicles: sql<number>`count(distinct ${vehicles.id})::int`,
          averagePriceCents: sql<number | null>`round(avg(${listings.priceCents}))::int`,
        })
        .from(listings)
        .innerJoin(vehicles, eq(listings.vehicleId, vehicles.id)),
      db
        .select({
          key: sources.key,
          name: sources.name,
          enabled: sources.enabled,
          liveEnabled: sources.liveEnabled,
          lastSuccessAt: sources.lastSuccessAt,
          lastFailureAt: sources.lastFailureAt,
          latestStatus: sql<string | null>`(
            select sr.status::text from ${sourceRuns} sr
            where sr.source_id = ${sources.id}
            order by sr.created_at desc limit 1
          )`,
        })
        .from(sources)
        .orderBy(sources.name),
      db
        .select({
          id: scrapeRuns.id,
          mode: scrapeRuns.mode,
          status: scrapeRuns.status,
          sourceCount: scrapeRuns.sourceCount,
          completedSourceCount: scrapeRuns.completedSourceCount,
          discoveredCount: scrapeRuns.discoveredCount,
          createdAt: scrapeRuns.createdAt,
          finishedAt: scrapeRuns.finishedAt,
        })
        .from(scrapeRuns)
        .orderBy(desc(scrapeRuns.createdAt))
        .limit(5),
    ]);

    response.json({
      data: {
        ...runSummary,
        ...(catalogRows[0] ?? { activeListings: 0, canonicalVehicles: 0, averagePriceCents: null }),
        sourceHealth,
        recentRuns,
      },
    });
  }),
);
