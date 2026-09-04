import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["password", "token", "secret", "authorization", "cookie", "DATABASE_URL", "AWS_SECRET_ACCESS_KEY", "req.headers.authorization", "req.headers.cookie", "req.body.password"],
    censor: "[redacted]",
  },
});
