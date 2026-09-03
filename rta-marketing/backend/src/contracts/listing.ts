import { z } from "zod";
import { sourceKeySchema } from "./scrape.js";

const optionalText = z.string().trim().min(1).max(500).nullish();

export const rawListingSchema = z
  .object({
    externalId: z.string().trim().min(1).max(200),
    source: sourceKeySchema,
    url: z.string().url(),
    title: z.string().trim().min(1).max(300),
    imageUrl: z.string().url().nullish(),
    vin: z.string().trim().max(32).nullish(),
    stockNumber: optionalText,
    make: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(100),
    trim: optionalText,
    year: z.coerce.number().int().min(1980).max(new Date().getUTCFullYear() + 1),
    price: z.union([z.number(), z.string()]).nullish(),
    odometer: z.union([z.number(), z.string()]).nullish(),
    currency: z.string().trim().length(3).default("CAD"),
    dealerName: optionalText,
    location: optionalText,
    bodyStyle: optionalText,
    transmission: optionalText,
    drivetrain: optionalText,
    engine: optionalText,
    exteriorColor: optionalText,
    condition: z.enum(["new", "used", "certified", "unknown"]).default("unknown"),
  })
  .strict();

export type RawListing = z.infer<typeof rawListingSchema>;

export interface CanonicalListing {
  externalId: string;
  source: z.infer<typeof sourceKeySchema>;
  url: string;
  title: string;
  imageUrl: string | null;
  vin: string | null;
  fingerprint: string;
  make: string;
  model: string;
  trim: string | null;
  year: number;
  priceCents: number | null;
  odometerKm: number | null;
  currency: string;
  dealerName: string | null;
  location: string | null;
  bodyStyle: string | null;
  transmission: string | null;
  drivetrain: string | null;
  engine: string | null;
  exteriorColor: string | null;
  isUsed: boolean;
}
