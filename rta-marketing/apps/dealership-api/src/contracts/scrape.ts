import { z } from "zod";

const currentYear = new Date().getUTCFullYear() + 1;

export const sourceKeySchema = z.enum([
  "autotrader",
  "autoplanet",
  "humberview",
  "yorkdalevw",
]);

export const scrapeFiltersSchema = z
  .object({
    make: z.string().trim().min(1).max(50).optional(),
    model: z.string().trim().min(1).max(80).optional(),
    keyword: z.string().trim().min(1).max(100).optional(),
    minYear: z.coerce.number().int().min(1980).max(currentYear).optional(),
    maxYear: z.coerce.number().int().min(1980).max(currentYear).optional(),
    minPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
    maxPrice: z.coerce.number().int().min(0).max(10_000_000).optional(),
    maxMileage: z.coerce.number().int().min(0).max(2_000_000).optional(),
    postalCode: z.string().trim().regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/).optional(),
    radiusKm: z.coerce.number().int().min(10).max(500).optional(),
    color: z.string().trim().min(1).max(40).optional(),
    transmission: z.string().trim().min(1).max(40).optional(),
  })
  .strict()
  .superRefine((filters, context) => {
    if (filters.minYear && filters.maxYear && filters.minYear > filters.maxYear) {
      context.addIssue({ code: "custom", path: ["minYear"], message: "Must be at most maxYear" });
    }
    if (filters.minPrice && filters.maxPrice && filters.minPrice > filters.maxPrice) {
      context.addIssue({ code: "custom", path: ["minPrice"], message: "Must be at most maxPrice" });
    }
  });

export const createScrapeRunSchema = z
  .object({
    filters: scrapeFiltersSchema,
    sources: z.array(sourceKeySchema).min(1).max(4).optional(),
    mode: z.enum(["fixture", "live"]).default("fixture"),
  })
  .strict();

export const scrapeJobSchema = z
  .object({
    version: z.literal(1),
    jobId: z.string().uuid(),
    runId: z.string().uuid(),
    sourceRunId: z.string().uuid(),
    sourceId: sourceKeySchema,
    mode: z.enum(["fixture", "live"]),
    filters: scrapeFiltersSchema,
  })
  .strict();

export type SourceKey = z.infer<typeof sourceKeySchema>;
export type ScrapeFilters = z.infer<typeof scrapeFiltersSchema>;
export type CreateScrapeRunInput = z.infer<typeof createScrapeRunSchema>;
export type ScrapeJob = z.infer<typeof scrapeJobSchema>;
