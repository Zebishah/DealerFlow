import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { assertCsrf, optionalSession } from "../../auth/session.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import { answerAssistantRequest } from "../../ai/orchestrator.js";

export function createAssistantRouter(options?: { rateLimitMax?: number; dailyQuota?: number }) {
  const assistantLimiter = rateLimit({
    windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
    limit: options?.rateLimitMax ?? env.AI_RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) => request.user?.id ?? ipKeyGenerator(request.ip ?? "anonymous"),
    handler: (_request, response) => {
      response.status(429).json({ error: { code: "AI_RATE_LIMITED", message: "Assistant request limit reached. Please try again shortly." } });
    },
  });

  const assistantDailyLimiter = rateLimit({
    windowMs: 86_400_000,
    limit: options?.dailyQuota ?? env.AI_DAILY_QUOTA,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) => request.user?.id ?? ipKeyGenerator(request.ip ?? "anonymous"),
    handler: (_request, response) => {
      response.status(429).json({ error: { code: "AI_DAILY_QUOTA_EXCEEDED", message: "The assistant daily quota has been reached. Please try again tomorrow." } });
    },
  });

  const router = Router();
  router.use(optionalSession);
  router.use(async (request, _response, next) => {
    try {
      // Public chat has no session and needs no CSRF token. Authenticated chat
      // is still protected because it reads workspace data through a cookie.
      if (request.sessionId) await assertCsrf(request);
      next();
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/chat",
    assistantLimiter,
    assistantDailyLimiter,
    asyncHandler(async (request, response) => {
      if (!env.AI_PUBLIC_CHAT_ENABLED && !request.user) throw new AppError(403, "AI_PUBLIC_CHAT_DISABLED", "The public assistant is currently unavailable");
      const input = z.unknown().parse(request.body);
      const answer = await answerAssistantRequest(input, request.user);
      response.json({ data: answer });
    }),
  );
  return router;
}

export const assistantRouter = createAssistantRouter();
