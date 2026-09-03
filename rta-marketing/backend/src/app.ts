import { randomUUID } from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { optionalSession } from "./auth/session.js";
import { authRouter } from "./auth/routes.js";
import { env } from "./config/env.js";
import { verifyDatabaseConnection } from "./db/client.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { catalogRouter } from "./modules/catalog/routes.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { runsRouter } from "./modules/runs/routes.js";
import { savedRouter } from "./modules/saved/routes.js";
import { sourcesRouter } from "./modules/sources/routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      level: env.LOG_LEVEL,
      genReqId: (request, response) => {
        const inbound = request.headers["x-request-id"];
        const requestId = typeof inbound === "string" && inbound.length <= 100 ? inbound : randomUUID();
        response.setHeader("x-request-id", requestId);
        return requestId;
      },
      redact: ["req.headers.authorization", "req.headers.cookie", "req.body.password"],
    }),
  );
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Origin is not allowed"));
      },
      credentials: true,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "idempotency-key", "x-csrf-token", "x-demo-session-id", "x-request-id"],
    }),
  );
  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: env.API_RATE_LIMIT_WINDOW_MS,
      limit: env.API_RATE_LIMIT_MAX,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      skip: (request) => request.path.startsWith("/health/"),
    }),
  );
  app.use(optionalSession);

  app.get("/health/live", (_request, response) => response.json({ status: "ok" }));
  app.get("/health/ready", async (_request, response, next) => {
    try {
      await verifyDatabaseConnection();
      response.json({ status: "ready" });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/vehicles", catalogRouter);
  app.use("/api/v1/scrape-runs", runsRouter);
  app.use("/api/v1/saved-vehicles", savedRouter);
  app.use("/api/v1/sources", sourcesRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
