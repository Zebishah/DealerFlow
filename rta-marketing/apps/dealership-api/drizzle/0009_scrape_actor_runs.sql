CREATE TABLE "scrape_actor_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "apify_run_id" text NOT NULL,
  "site_id" integer NOT NULL,
  "site_key" text NOT NULL,
  "requested_limit" integer NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "progress_stage" text,
  "found_count" integer,
  "duration_ms" integer,
  "timings" jsonb,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "scrape_actor_runs_apify_id_uq" UNIQUE("apify_run_id"),
  CONSTRAINT "scrape_actor_runs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "scrape_actor_runs_status_created_idx" ON "scrape_actor_runs" USING btree ("status", "created_at");
