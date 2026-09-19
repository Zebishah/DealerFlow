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

export const userRole = pgEnum("user_role", [
  "operator",
  "viewer",
  "admin",
  "employee",
  "virtual_assistant",
  "recruiter",
]);
export const accessRequestStatus = pgEnum("access_request_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
  "revoked",
]);
export const workspaceMode = pgEnum("workspace_mode", ["demo", "live"]);
export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
]);
export const saleStatus = pgEnum("sale_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "funded",
  "cancelled",
]);
export const saleType = pgEnum("sale_type", ["retail", "wholesale"]);
export const documentKind = pgEnum("document_kind", ["insurance", "drivers_license", "omvic", "employment", "other"]);
export const documentStatus = pgEnum("document_status", ["pending", "verified", "rejected"]);
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

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    mode: workspaceMode("mode").notNull().default("live"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("workspaces_slug_uq").on(table.slug)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "restrict",
    }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    role: userRole("role").notNull().default("viewer"),
    isActive: boolean("is_active").notNull().default(true),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    temporaryPasswordExpiresAt: timestamp("temporary_password_expires_at", { withTimezone: true }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    emailVerificationTokenHash: text("email_verification_token_hash"),
    emailVerificationExpiresAt: timestamp("email_verification_expires_at", { withTimezone: true }),
    emailVerificationSentAt: timestamp("email_verification_sent_at", { withTimezone: true }),
    passwordResetTokenHash: text("password_reset_token_hash"),
    passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true }),
    accessInviteTokenHash: text("access_invite_token_hash"),
    accessInviteExpiresAt: timestamp("access_invite_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_uq").on(sql`lower(${table.email})`),
    index("users_workspace_role_idx").on(table.workspaceId, table.role),
  ],
);

export const employeeDocuments = pgTable(
  "employee_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    kind: documentKind("kind").notNull(),
    status: documentStatus("status").notNull().default("pending"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    checksumSha256: text("checksum_sha256"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("employee_documents_storage_key_uq").on(table.storageKey),
    index("employee_documents_workspace_user_idx").on(table.workspaceId, table.userId),
    index("employee_documents_workspace_status_idx").on(table.workspaceId, table.status),
    index("employee_documents_expires_idx").on(table.expiresAt),
  ],
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

export const accessRequests = pgTable(
  "access_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fullName: text("full_name").notNull(),
    company: text("company").notNull(),
    jobTitle: text("job_title").notNull(),
    email: text("email").notNull(),
    linkedInUrl: text("linkedin_url"),
    reason: text("reason").notNull(),
    platformScope: jsonb("platform_scope").$type<string[]>().notNull(),
    requestedPermissions: jsonb("requested_permissions").$type<string[]>().notNull(),
    requestedDuration: text("requested_duration").notNull(),
    message: text("message"),
    status: accessRequestStatus("status").notNull().default("pending"),
    grantedPermissions: jsonb("granted_permissions").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    provisionedUserId: uuid("provisioned_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedUntil: timestamp("approved_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("access_requests_status_created_idx").on(table.status, table.createdAt),
    index("access_requests_email_created_idx").on(table.email, table.createdAt),
    index("access_requests_provisioned_user_idx").on(table.provisionedUserId),
  ],
);

export const leadSources = pgTable(
  "lead_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lead_sources_workspace_name_uq").on(
      table.workspaceId,
      sql`lower(${table.name})`,
    ),
    index("lead_sources_workspace_active_idx").on(table.workspaceId, table.isActive),
  ],
);

export const financeProviders = pgTable(
  "finance_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("finance_providers_workspace_name_uq").on(
      table.workspaceId,
      sql`lower(${table.name})`,
    ),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => leadSources.id, {
      onDelete: "set null",
    }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    externalReference: text("external_reference"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    vehicleInterest: text("vehicle_interest"),
    status: leadStatus("status").notNull().default("new"),
    notes: text("notes"),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("leads_workspace_external_reference_uq").on(
      table.workspaceId,
      table.externalReference,
    ),
    index("leads_workspace_status_created_idx").on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
    index("leads_assigned_status_idx").on(table.assignedToUserId, table.status),
  ],
);

export const commissionRules = pgTable(
  "commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    retailRateBasisPoints: integer("retail_rate_basis_points").notNull(),
    wholesaleRateBasisPoints: integer("wholesale_rate_basis_points").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("commission_rules_workspace_user_active_idx").on(
      table.workspaceId,
      table.userId,
      table.isActive,
    ),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    salespersonId: uuid("salesperson_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    financeProviderId: uuid("finance_provider_id").references(
      () => financeProviders.id,
      { onDelete: "set null" },
    ),
    externalSaleId: text("external_sale_id").notNull(),
    type: saleType("type").notNull(),
    status: saleStatus("status").notNull().default("draft"),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    vehicleVin: text("vehicle_vin"),
    vehicleDescription: text("vehicle_description").notNull(),
    salePriceCents: integer("sale_price_cents").notNull(),
    grossProfitCents: integer("gross_profit_cents").notNull(),
    commissionRateBasisPoints: integer("commission_rate_basis_points").notNull(),
    commissionAmountCents: integer("commission_amount_cents").notNull(),
    soldAt: timestamp("sold_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sales_workspace_external_id_uq").on(
      table.workspaceId,
      table.externalSaleId,
    ),
    index("sales_workspace_status_sold_idx").on(
      table.workspaceId,
      table.status,
      table.soldAt,
    ),
    index("sales_salesperson_sold_idx").on(table.salespersonId, table.soldAt),
  ],
);

export const monthlyTargets = pgTable(
  "monthly_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    retailTarget: integer("retail_target").notNull().default(0),
    wholesaleTarget: integer("wholesale_target").notNull().default(0),
    grossProfitTargetCents: integer("gross_profit_target_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("monthly_targets_workspace_user_month_uq").on(
      table.workspaceId,
      sql`coalesce(${table.userId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      table.month,
    ),
  ],
);

export const idempotencyRecords = pgTable(
  "idempotency_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_records_operation_key_uq").on(
      table.workspaceId,
      table.operation,
      table.key,
    ),
    index("idempotency_records_expires_at_idx").on(table.expiresAt),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("audit_events_entity_idx").on(table.entityType, table.entityId),
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
    requestHash: text("request_hash").notNull(),
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

export const jobOutbox = pgTable(
  "job_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceRunId: uuid("source_run_id")
      .notNull()
      .references(() => sourceRuns.id, { onDelete: "cascade" }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("job_outbox_source_run_uq").on(table.sourceRunId),
    index("job_outbox_dispatch_idx").on(table.status, table.availableAt),
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
  (table) => [
    uniqueIndex("ingestion_rejections_source_reason_fingerprint_uq").on(
      table.sourceRunId,
      table.reasonCode,
      table.recordFingerprint,
    ),
    index("ingestion_rejections_source_run_idx").on(table.sourceRunId),
  ],
);

// Tables owned by the separate Docker/BullMQ scraper stack. They share Neon
// with this admin application so operators can inspect its output here.
export const scrapingSites = pgTable("sites", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }),
});

export const scrapeActorRuns = pgTable(
  "scrape_actor_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apifyRunId: text("apify_run_id").notNull(),
    siteId: integer("site_id").notNull(),
    siteKey: text("site_key").notNull(),
    requestedLimit: integer("requested_limit").notNull(),
    status: text("status").notNull().default("queued"),
    progressStage: text("progress_stage"),
    foundCount: integer("found_count"),
    recordsDiscovered: integer("records_discovered"),
    recordsAccepted: integer("records_accepted"),
    recordsRejected: integer("records_rejected"),
    parserVersion: text("parser_version"),
    durationMs: integer("duration_ms"),
    timings: jsonb("timings").$type<Record<string, number>>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("scrape_actor_runs_apify_id_uq").on(table.apifyRunId),
    index("scrape_actor_runs_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const scrapedItems = pgTable("scraped_items", {
  id: integer("id").primaryKey(),
  siteId: integer("site_id").notNull(),
  title: text("title").notNull(),
  price: text("price"),
  year: text("year"),
  mileage: text("mileage"),
  city: text("city"),
  listingUrl: text("listing_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).notNull(),
});

export const savedScrapedItems = pgTable(
  "saved_scraped_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scrapedItemId: integer("scraped_item_id")
      .notNull()
      .references(() => scrapedItems.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("saved_scraped_items_user_item_uq").on(table.userId, table.scrapedItemId),
    index("saved_scraped_items_user_idx").on(table.userId, table.createdAt),
  ],
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
export type User = typeof users.$inferSelect;
export type UserRole = User["role"];
export type Workspace = typeof workspaces.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type AccessRequest = typeof accessRequests.$inferSelect;
