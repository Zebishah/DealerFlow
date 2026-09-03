import { asc } from "drizzle-orm";
import { Router } from "express";
import { db } from "../../db/client.js";
import { sources } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";

export const sourcesRouter = Router();

sourcesRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    const rows = await db.select().from(sources).orderBy(asc(sources.name));
    response.json({ data: rows });
  }),
);
