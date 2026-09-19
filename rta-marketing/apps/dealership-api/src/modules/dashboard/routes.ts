import { desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { requireSession, requireWorkspaceForRoles } from "../../auth/session.js";
import { db } from "../../db/client.js";
import { listings, scrapeRuns, sourceRuns, sources, vehicles } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { getRunSummary } from "../runs/run.service.js";
import { cacheAside, cacheScope } from "../../infra/cache.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireSession);
dashboardRouter.use(requireWorkspaceForRoles("admin", "employee", "virtual_assistant", "recruiter", "viewer"));

dashboardRouter.get(
  "/summary",
  asyncHandler(async (request, response) => {
    const canViewPlatformTelemetry = ["admin", "operator", "recruiter"].includes(request.user!.role);
    const data = await cacheAside({
      namespace: "dashboard",
      scope: cacheScope(request.user!.workspaceId, canViewPlatformTelemetry ? "telemetry" : "workspace"),
      filters: { summary: "overview" },
      ttlSeconds: 45,
      load: async () => {
        const [runSummary, catalogRows, sourceHealth, recentRuns] = await Promise.all([
          canViewPlatformTelemetry
            ? getRunSummary()
            : Promise.resolve({ totalRuns: 0, successfulRuns: 0, activeRuns: 0, failedRuns: 0 }),
          db
            .select({
              activeListings: sql<number>`count(${listings.id}) filter (where ${listings.status} = 'active')::int`,
              canonicalVehicles: sql<number>`count(distinct ${vehicles.id})::int`,
              averagePriceCents: sql<number | null>`round(avg(${listings.priceCents}))::int`,
            })
            .from(listings)
            .innerJoin(vehicles, eq(listings.vehicleId, vehicles.id)),
          canViewPlatformTelemetry
            ? db
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
              .orderBy(sources.name)
            : db
              .select({
                key: sources.key,
                name: sources.name,
                enabled: sources.enabled,
                liveEnabled: sql<boolean>`false`,
                lastSuccessAt: sql<Date | null>`null`,
                lastFailureAt: sql<Date | null>`null`,
                latestStatus: sql<string | null>`null`,
              })
              .from(sources)
              .orderBy(sources.name),
          canViewPlatformTelemetry
            ? db
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
              .limit(5)
            : Promise.resolve([]),
        ]);

        return {
        ...runSummary,
        ...(catalogRows[0] ?? { activeListings: 0, canonicalVehicles: 0, averagePriceCents: null }),
        sourceHealth,
        recentRuns,
        };
      },
    });
    response.json({ data });
  }),
);
