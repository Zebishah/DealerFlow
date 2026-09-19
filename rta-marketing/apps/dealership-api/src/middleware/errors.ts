import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { isAppError } from "../lib/errors.js";
import { incrementMetric } from "../infra/metrics.js";

export const notFound: RequestHandler = (request, response) => {
  response.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: `No route matches ${request.method} ${request.path}` },
  });
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request contains invalid values",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        requestId: request.id,
      },
    });
    return;
  }

  if (isAppError(error)) {
    response.status(error.statusCode).json({
      error: { code: error.code, message: error.message, details: error.details, requestId: request.id },
    });
    return;
  }

  const errorText = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  if (/postgres|database|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH/i.test(errorText)) incrementMetric("db_errors");
  request.log.error({ err: error }, "Unhandled request error");
  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId: request.id },
  });
};
