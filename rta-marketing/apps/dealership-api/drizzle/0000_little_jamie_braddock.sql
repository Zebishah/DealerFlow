CREATE TYPE "public"."listing_status" AS ENUM('active', 'stale', 'removed');--> statement-breakpoint
CREATE TYPE "public"."run_mode" AS ENUM('fixture', 'live');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'partial', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."source_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('operator', 'viewer');--> statement-breakpoint
CREATE TABLE "ingestion_rejections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_run_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"safe_message" text NOT NULL,
	"record_fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"source_run_id" uuid NOT NULL,
	"price_cents" integer,
	"odometer_km" integer,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"image_url" text,
	"title" text NOT NULL,
	"dealer_name" text,
	"location" text,
	"price_cents" integer,
	"currency" text DEFAULT 'CAD' NOT NULL,
	"odometer_km" integer,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"demo_session_id" uuid,
	"vehicle_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scrape_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by_user_id" uuid,
	"idempotency_key" text NOT NULL,
	"mode" "run_mode" DEFAULT 'fixture' NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"filters" jsonb NOT NULL,
	"source_count" integer DEFAULT 0 NOT NULL,
	"completed_source_count" integer DEFAULT 0 NOT NULL,
	"failed_source_count" integer DEFAULT 0 NOT NULL,
	"discovered_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "source_run_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"discovered_count" integer DEFAULT 0 NOT NULL,
	"valid_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"live_enabled" boolean DEFAULT false NOT NULL,
	"max_concurrency" integer DEFAULT 1 NOT NULL,
	"min_delay_ms" integer DEFAULT 1500 NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vin" text,
	"fingerprint" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"trim" text,
	"year" integer NOT NULL,
	"body_style" text,
	"transmission" text,
	"drivetrain" text,
	"engine" text,
	"exterior_color" text,
	"is_used" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingestion_rejections" ADD CONSTRAINT "ingestion_rejections_source_run_id_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."source_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_observations" ADD CONSTRAINT "listing_observations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_observations" ADD CONSTRAINT "listing_observations_source_run_id_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."source_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_vehicles" ADD CONSTRAINT "saved_vehicles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_vehicles" ADD CONSTRAINT "saved_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_run_id_scrape_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."scrape_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_rejections_source_run_idx" ON "ingestion_rejections" USING btree ("source_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_observations_run_listing_uq" ON "listing_observations" USING btree ("source_run_id","listing_id");--> statement-breakpoint
CREATE INDEX "listing_observations_listing_time_idx" ON "listing_observations" USING btree ("listing_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_source_external_id_uq" ON "listings" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "listings_vehicle_id_idx" ON "listings" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "listings_status_price_idx" ON "listings" USING btree ("status","price_cents");--> statement-breakpoint
CREATE INDEX "listings_last_seen_at_idx" ON "listings" USING btree ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_vehicles_user_vehicle_uq" ON "saved_vehicles" USING btree ("user_id","vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_vehicles_demo_vehicle_uq" ON "saved_vehicles" USING btree ("demo_session_id","vehicle_id");--> statement-breakpoint
CREATE INDEX "saved_vehicles_vehicle_id_idx" ON "saved_vehicles" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scrape_runs_idempotency_key_uq" ON "scrape_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "scrape_runs_status_created_at_idx" ON "scrape_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uq" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "source_runs_run_source_uq" ON "source_runs" USING btree ("run_id","source_id");--> statement-breakpoint
CREATE INDEX "source_runs_status_created_at_idx" ON "source_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_key_uq" ON "sources" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_vin_uq" ON "vehicles" USING btree ("vin");--> statement-breakpoint
CREATE INDEX "vehicles_fingerprint_idx" ON "vehicles" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "vehicles_make_model_year_idx" ON "vehicles" USING btree ("make","model","year");