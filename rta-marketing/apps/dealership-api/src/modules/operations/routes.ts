import { Router } from "express";
import { requireCsrf, requireRoles, requireSession } from "../../auth/session.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { collectMetricsSummary, collectOperationalHealth, getSourceHealth } from "./service.js";
import { reconcileStuckApifyRuns } from "../acquisition/reconciliation.js";

export const operationsRouter = Router();
operationsRouter.use(requireSession, requireRoles("admin", "operator", "recruiter"));

operationsRouter.get("/health", asyncHandler(async (_request, response) => {
  response.json({ data: await collectOperationalHealth() });
}));

operationsRouter.get("/metrics-summary", asyncHandler(async (_request, response) => {
  response.json({ data: await collectMetricsSummary() });
}));

operationsRouter.get("/source-health", asyncHandler(async (_request, response) => {
  response.json({ data: await getSourceHealth() });
}));

operationsRouter.post("/reconcile-apify", requireCsrf, asyncHandler(async (_request, response) => {
  response.json({ data: await reconcileStuckApifyRuns() });
}));
