import { randomUUID } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { createScrapeRunSchema } from "../../contracts/scrape.js";
import { assertCsrf, assertOperator, requireCsrf, requireOperator, requireSession } from "../../auth/session.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import { cancelScrapeRun, createScrapeRun, getScrapeRun, listScrapeRuns, replaySourceRun } from "./run.service.js";

const idSchema = z.string().uuid();
const listSchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

const scrapeLimiter = rateLimit({
  windowMs: env.SCRAPE_RATE_LIMIT_WINDOW_MS,
  limit: env.SCRAPE_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "SCRAPE_RATE_LIMITED", message: "Scrape run limit reached" } },
});

export const runsRouter = Router();

runsRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = listSchema.parse(request.query);
    response.json({ data: await listScrapeRuns(query.limit) });
  }),
);

runsRouter.get(
  "/:id",
  asyncHandler(async (request, response) => {
    response.json({ data: await getScrapeRun(idSchema.parse(request.params.id)) });
  }),
);

runsRouter.post(
  "/",
  scrapeLimiter,
  asyncHandler(async (request, response) => {
    const input = createScrapeRunSchema.parse(request.body);
    if (input.mode === "live") {
      if (!env.ALLOW_LIVE_SCRAPING) {
        throw new AppError(403, "LIVE_SCRAPING_DISABLED", "Live scraping is currently disabled");
      }
      assertOperator(request);
      await assertCsrf(request);
    }
    await createAndRespond();

    async function createAndRespond() {
      const rawKey = request.header("idempotency-key") ?? randomUUID();
      const idempotencyKey = z.string().min(8).max(200).parse(rawKey);
      const run = await createScrapeRun(input, idempotencyKey, request.user?.id);
      response
        .status(run.reused ? 200 : 202)
        .location(`/api/v1/scrape-runs/${run.id}`)
        .json({ data: run });
    }
  }),
);

runsRouter.post(
  "/:id/cancel",
  requireSession,
  requireOperator,
  requireCsrf,
  asyncHandler(async (request, response) => {
    await cancelScrapeRun(idSchema.parse(request.params.id));
    response.status(202).json({ data: { status: "cancelled" } });
  }),
);

runsRouter.post(
  "/:id/sources/:sourceRunId/replay",
  requireSession,
  requireOperator,
  requireCsrf,
  asyncHandler(async (request, response) => {
    const runId = idSchema.parse(request.params.id);
    const sourceRunId = idSchema.parse(request.params.sourceRunId);
    await replaySourceRun(runId, sourceRunId);
    response.status(202).json({ data: { status: "queued" } });
  }),
);
