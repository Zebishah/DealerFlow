import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["operator", "viewer"]);
export const runMode = pgEnum("run_mode", ["fixture", "live"]);
export const runStatus = pgEnum("run_status", [
  "queued",
  "running",
  "partial",
  "completed",
  "failed",
  "cancelled",
]);
export const sourceRunStatus = pgEnum("source_run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "dead_letter",
]);
export const listingStatus = pgEnum("listing_status", [
  "active",
  "stale",
  "removed",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("viewer"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_uq").on(sql`lower(${table.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    csrfHash: text("csrf_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uq").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    liveEnabled: boolean("live_enabled").notNull().default(false),
    maxConcurrency: integer("max_concurrency").notNull().default(1),
    minDelayMs: integer("min_delay_ms").notNull().default(1500),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sources_key_uq").on(table.key)],
);

export const scrapeRuns = pgTable(
  "scrape_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key").notNull(),
    mode: runMode("mode").notNull().default("fixture"),
    status: runStatus("status").notNull().default("queued"),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull(),
    sourceCount: integer("source_count").notNull().default(0),
    completedSourceCount: integer("completed_source_count").notNull().default(0),
    failedSourceCount: integer("failed_source_count").notNull().default(0),
    discoveredCount: integer("discovered_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("scrape_runs_idempotency_key_uq").on(table.idempotencyKey),
    index("scrape_runs_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export const sourceRuns = pgTable(
  "source_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id")
      .notNull()
      .references(() => scrapeRuns.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    status: sourceRunStatus("status").notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    progressPercent: integer("progress_percent").notNull().default(0),
    discoveredCount: integer("discovered_count").notNull().default(0),
    validCount: integer("valid_count").notNull().default(0),
    insertedCount: integer("inserted_count").notNull().default(0),
    updatedCount: integer("updated_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("source_runs_run_source_uq").on(table.runId, table.sourceId),
    index("source_runs_status_created_at_idx").on(table.status, table.createdAt),
  ],
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vin: text("vin"),
    fingerprint: text("fingerprint").notNull(),
    make: text("make").notNull(),
    model: text("model").notNull(),
    trim: text("trim"),
    year: integer("year").notNull(),
    bodyStyle: text("body_style"),
    transmission: text("transmission"),
    drivetrain: text("drivetrain"),
    engine: text("engine"),
    exteriorColor: text("exterior_color"),
    isUsed: boolean("is_used").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vehicles_vin_uq").on(table.vin),
    index("vehicles_fingerprint_idx").on(table.fingerprint),
    index("vehicles_make_model_year_idx").on(table.make, table.model, table.year),
  ],
);

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    imageUrl: text("image_url"),
    title: text("title").notNull(),
    dealerName: text("dealer_name"),
    location: text("location"),
    priceCents: integer("price_cents"),
    currency: text("currency").notNull().default("CAD"),
    odometerKm: integer("odometer_km"),
    status: listingStatus("status").notNull().default("active"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("listings_source_external_id_uq").on(table.sourceId, table.externalId),
    index("listings_vehicle_id_idx").on(table.vehicleId),
    index("listings_status_price_idx").on(table.status, table.priceCents),
    index("listings_last_seen_at_idx").on(table.lastSeenAt),
  ],
);

export const listingObservations = pgTable(
  "listing_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    sourceRunId: uuid("source_run_id")
      .notNull()
      .references(() => sourceRuns.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents"),
    odometerKm: integer("odometer_km"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("listing_observations_run_listing_uq").on(
      table.sourceRunId,
      table.listingId,
    ),
    index("listing_observations_listing_time_idx").on(
      table.listingId,
      table.observedAt,
    ),
  ],
);

export const savedVehicles = pgTable(
  "saved_vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    demoSessionId: uuid("demo_session_id"),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("saved_vehicles_user_vehicle_uq").on(table.userId, table.vehicleId),
    uniqueIndex("saved_vehicles_demo_vehicle_uq").on(
      table.demoSessionId,
      table.vehicleId,
    ),
    index("saved_vehicles_vehicle_id_idx").on(table.vehicleId),
  ],
);

export const ingestionRejections = pgTable(
  "ingestion_rejections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceRunId: uuid("source_run_id")
      .notNull()
      .references(() => sourceRuns.id, { onDelete: "cascade" }),
    reasonCode: text("reason_code").notNull(),
    safeMessage: text("safe_message").notNull(),
    recordFingerprint: text("record_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ingestion_rejections_source_run_idx").on(table.sourceRunId)],
);

export const scrapeRunRelations = relations(scrapeRuns, ({ many, one }) => ({
  requestedBy: one(users, {
    fields: [scrapeRuns.requestedByUserId],
    references: [users.id],
  }),
  sourceRuns: many(sourceRuns),
}));

export const sourceRunRelations = relations(sourceRuns, ({ one, many }) => ({
  run: one(scrapeRuns, { fields: [sourceRuns.runId], references: [scrapeRuns.id] }),
  source: one(sources, { fields: [sourceRuns.sourceId], references: [sources.id] }),
  observations: many(listingObservations),
  rejections: many(ingestionRejections),
}));

export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type SourceRun = typeof sourceRuns.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Listing = typeof listings.$inferSelect;
