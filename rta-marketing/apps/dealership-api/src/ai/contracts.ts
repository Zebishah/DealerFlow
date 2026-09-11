import { z } from "zod";

export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
});

export const assistantContextSchema = z.object({
  route: z.string().trim().min(1).max(200),
  entityType: z.enum(["none", "lead", "sale", "vehicle", "scrape_run", "source"]).default("none"),
  entityId: z.string().uuid().optional(),
});

export const assistantRequestSchema = z.object({
  message: z.string().trim().min(1).max(8_000),
  history: z.array(assistantMessageSchema).max(12).default([]),
  context: assistantContextSchema.optional(),
});

export const assistantSourceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  kind: z.enum(["product", "database", "page", "tool"]),
});

export const assistantNavigationSchema = z.object({
  label: z.string().trim().min(1).max(80),
  path: z.enum([
    "/",
    "/login",
    "/signup",
    "/app/overview",
    "/app/leads",
    "/app/sales",
    "/app/analytics",
    "/app/inventory",
    "/app/saved-vehicles",
    "/app/compare",
    "/app/acquisition",
    "/app/source-control",
    "/app/documents",
    "/app/team",
    "/app/audit",
    "/app/performance-board",
    "/app/configuration",
    "/app/settings",
    "/app/commissions",
    "/app/targets",
    "/app/scraping-results",
    "/app/access-requests",
  ]),
});

export const assistantAnswerSchema = z.object({
  answer: z.string().trim().min(1).max(8_000),
  sources: z.array(assistantSourceSchema).max(8).default([]),
  suggestions: z.array(z.string().trim().min(1).max(160)).max(4).default([]),
  navigation: z.array(assistantNavigationSchema).max(2).default([]),
});

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantAnswer = z.infer<typeof assistantAnswerSchema>;
export type AssistantContext = z.infer<typeof assistantContextSchema>;
