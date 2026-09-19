import { asc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireCsrf, requireOperator, requireRoles, requireSession } from "../../auth/session.js";
import { db } from "../../db/client.js";
import { sources } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { cacheAside, cacheScope } from "../../infra/cache.js";

export const sourcesRouter = Router();

const sourceUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  liveEnabled: z.boolean().optional(),
}).strict().refine((value) => value.enabled !== undefined || value.liveEnabled !== undefined, {
  message: "At least one source setting is required",
});

sourcesRouter.get(
  "/",
  requireSession,
  requireRoles("admin", "operator", "recruiter"),
  asyncHandler(async (request, response) => {
    const data = await cacheAside({
      namespace: "source-health",
      scope: cacheScope(request.user?.workspaceId, request.user?.role ?? "unknown"),
      filters: { list: "all-sources" },
      ttlSeconds: 20,
      load: () => db.select().from(sources).orderBy(asc(sources.name)),
    });
    response.json({ data });
  }),
);

sourcesRouter.patch(
  "/:key",
  requireSession,
  requireOperator,
  requireCsrf,
  asyncHandler(async (request, response) => {
    const key = z.string().min(1).max(64).parse(request.params.key);
    const update = sourceUpdateSchema.parse(request.body);
    const [row] = await db
      .update(sources)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(sources.key, key))
      .returning();
    if (!row) return response.status(404).json({ error: { code: "SOURCE_NOT_FOUND", message: "Source was not found" } });
    response.json({ data: row });
  }),
);
