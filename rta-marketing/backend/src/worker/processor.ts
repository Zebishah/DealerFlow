import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  ingestionRejections,
  listingObservations,
  listings,
  scrapeRuns,
  sourceRuns,
  sources,
  vehicles,
} from "../db/schema.js";
import { rawListingSchema, type CanonicalListing } from "../contracts/listing.js";
import { scrapeJobSchema, type ScrapeJob } from "../contracts/scrape.js";
import { normalizeListing } from "../lib/normalization.js";
import { logger } from "../lib/logger.js";
import { acquireListings } from "./adapter.js";
import { recomputeRun } from "./run-status.js";

export interface JobResult {
  skipped: boolean;
  discovered: number;
  inserted: number;
  updated: number;
  rejected: number;
}

function safeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    return {
      code: error.name.replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 60) || "SCRAPE_FAILED",
      message: error.message.replace(/https?:\/\/\S+/g, "[source URL]").slice(0, 500),
    };
  }
  return { code: "SCRAPE_FAILED", message: "The source job failed" };
}

async function upsertCanonical(
  sourceRunId: string,
  sourceId: string,
  listing: CanonicalListing,
): Promise<"inserted" | "updated"> {
  return db.transaction(async (tx) => {
    const [existingListing] = await tx
      .select({ id: listings.id, vehicleId: listings.vehicleId })
      .from(listings)
      .where(and(eq(listings.sourceId, sourceId), eq(listings.externalId, listing.externalId)))
      .limit(1);

    let vehicleId = existingListing?.vehicleId;
    if (!vehicleId && listing.vin) {
      const [vehicle] = await tx
        .insert(vehicles)
        .values({
          vin: listing.vin,
          fingerprint: listing.fingerprint,
          make: listing.make,
          model: listing.model,
          trim: listing.trim,
          year: listing.year,
          bodyStyle: listing.bodyStyle,
          transmission: listing.transmission,
          drivetrain: listing.drivetrain,
          engine: listing.engine,
          exteriorColor: listing.exteriorColor,
          isUsed: listing.isUsed,
        })
        .onConflictDoUpdate({
          target: vehicles.vin,
          set: { updatedAt: new Date() },
        })
        .returning({ id: vehicles.id });
      vehicleId = vehicle?.id;
    }
    if (!vehicleId) {
      const [candidate] = await tx
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(eq(vehicles.fingerprint, listing.fingerprint))
        .limit(1);
      if (candidate) vehicleId = candidate.id;
    }
    if (!vehicleId) {
      const [vehicle] = await tx
        .insert(vehicles)
        .values({
          vin: listing.vin,
          fingerprint: listing.fingerprint,
          make: listing.make,
          model: listing.model,
          trim: listing.trim,
          year: listing.year,
          bodyStyle: listing.bodyStyle,
          transmission: listing.transmission,
          drivetrain: listing.drivetrain,
          engine: listing.engine,
          exteriorColor: listing.exteriorColor,
          isUsed: listing.isUsed,
        })
        .returning({ id: vehicles.id });
      vehicleId = vehicle?.id;
    }
    if (!vehicleId) throw new Error("Vehicle upsert did not return an ID");

    const [savedListing] = await tx
      .insert(listings)
      .values({
        vehicleId,
        sourceId,
        externalId: listing.externalId,
        url: listing.url,
        imageUrl: listing.imageUrl,
        title: listing.title,
        dealerName: listing.dealerName,
        location: listing.location,
        priceCents: listing.priceCents,
        currency: listing.currency,
        odometerKm: listing.odometerKm,
      })
      .onConflictDoUpdate({
        target: [listings.sourceId, listings.externalId],
        set: {
          vehicleId,
          url: listing.url,
          imageUrl: listing.imageUrl,
          title: listing.title,
          dealerName: listing.dealerName,
          location: listing.location,
          priceCents: listing.priceCents,
          currency: listing.currency,
          odometerKm: listing.odometerKm,
          status: "active",
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning({ id: listings.id });
    if (!savedListing) throw new Error("Listing upsert did not return an ID");

    await tx
      .insert(listingObservations)
      .values({
        listingId: savedListing.id,
        sourceRunId,
        priceCents: listing.priceCents,
        odometerKm: listing.odometerKm,
      })
      .onConflictDoNothing();

    return existingListing ? "updated" : "inserted";
  });
}

export async function processScrapeJob(input: unknown): Promise<JobResult> {
  const job: ScrapeJob = scrapeJobSchema.parse(input);
  const jobStartedAt = Date.now();
  const [context] = await db
    .select({
      sourceRunStatus: sourceRuns.status,
      runStatus: scrapeRuns.status,
      sourceDbId: sources.id,
      sourceMinDelayMs: sources.minDelayMs,
    })
    .from(sourceRuns)
    .innerJoin(scrapeRuns, eq(sourceRuns.runId, scrapeRuns.id))
    .innerJoin(sources, eq(sourceRuns.sourceId, sources.id))
    .where(
      and(
        eq(sourceRuns.id, job.sourceRunId),
        eq(sourceRuns.runId, job.runId),
        eq(sources.key, job.sourceId),
      ),
    )
    .limit(1);

  if (!context) throw new Error("SQS job does not match a source run");
  if (context.sourceRunStatus === "completed" || context.runStatus === "cancelled") {
    logger.info(
      {
        runId: job.runId,
        sourceRunId: job.sourceRunId,
        source: job.sourceId,
        runStatus: context.runStatus,
        sourceRunStatus: context.sourceRunStatus,
      },
      "Scrape source job skipped because it is already terminal",
    );
    return { skipped: true, discovered: 0, inserted: 0, updated: 0, rejected: 0 };
  }

  logger.info(
    {
      runId: job.runId,
      sourceRunId: job.sourceRunId,
      source: job.sourceId,
      mode: job.mode,
    },
    "Scrape source job started",
  );

  await db
    .update(sourceRuns)
    .set({
      status: "running",
      attemptCount: sql`${sourceRuns.attemptCount} + 1`,
      progressPercent: 5,
      errorCode: null,
      errorMessage: null,
      startedAt: sql`coalesce(${sourceRuns.startedAt}, now())`,
      updatedAt: new Date(),
    })
    .where(eq(sourceRuns.id, job.sourceRunId));
  await recomputeRun(job.runId);

  try {
    const acquired = await acquireListings(job.sourceId, job.mode, job.filters, context.sourceMinDelayMs);
    let inserted = 0;
    let updated = 0;
    let rejected = 0;

    for (const [index, value] of acquired.entries()) {
      const parsed = rawListingSchema.safeParse(value);
      if (!parsed.success) {
        rejected += 1;
        await db.insert(ingestionRejections).values({
          sourceRunId: job.sourceRunId,
          reasonCode: "RAW_VALIDATION_FAILED",
          safeMessage: parsed.error.issues.slice(0, 3).map((issue) => issue.message).join("; "),
          recordFingerprint: createHash("sha256").update(JSON.stringify(value)).digest("hex"),
        });
        continue;
      }
      const result = await upsertCanonical(job.sourceRunId, context.sourceDbId, normalizeListing(parsed.data));
      if (result === "inserted") inserted += 1;
      else updated += 1;
      await db
        .update(sourceRuns)
        .set({ progressPercent: Math.max(10, Math.round(((index + 1) / acquired.length) * 95)), updatedAt: new Date() })
        .where(eq(sourceRuns.id, job.sourceRunId));
    }

    await db
      .update(sourceRuns)
      .set({
        status: "completed",
        progressPercent: 100,
        discoveredCount: acquired.length,
        validCount: acquired.length - rejected,
        insertedCount: inserted,
        updatedCount: updated,
        rejectedCount: rejected,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sourceRuns.id, job.sourceRunId));
    await db
      .update(sources)
      .set({ lastSuccessAt: new Date(), updatedAt: new Date() })
      .where(eq(sources.id, context.sourceDbId));
    await recomputeRun(job.runId);
    const result = {
      skipped: false,
      discovered: acquired.length,
      inserted,
      updated,
      rejected,
    };
    logger.info(
      {
        runId: job.runId,
        sourceRunId: job.sourceRunId,
        source: job.sourceId,
        mode: job.mode,
        durationMs: Date.now() - jobStartedAt,
        ...result,
      },
      "Scrape source job completed",
    );
    return result;
  } catch (error) {
    const safe = safeError(error);
    await db
      .update(sourceRuns)
      .set({ status: "failed", errorCode: safe.code, errorMessage: safe.message, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(sourceRuns.id, job.sourceRunId));
    await db
      .update(sources)
      .set({ lastFailureAt: new Date(), updatedAt: new Date() })
      .where(eq(sources.id, context.sourceDbId));
    await recomputeRun(job.runId);
    logger.error(
      {
        runId: job.runId,
        sourceRunId: job.sourceRunId,
        source: job.sourceId,
        mode: job.mode,
        durationMs: Date.now() - jobStartedAt,
        errorCode: safe.code,
      },
      "Scrape source job failed",
    );
    throw error;
  }
}

