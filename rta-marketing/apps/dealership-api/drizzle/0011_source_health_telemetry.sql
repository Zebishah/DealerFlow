ALTER TABLE "scrape_actor_runs" ADD COLUMN "records_discovered" integer;
--> statement-breakpoint
ALTER TABLE "scrape_actor_runs" ADD COLUMN "records_accepted" integer;
--> statement-breakpoint
ALTER TABLE "scrape_actor_runs" ADD COLUMN "records_rejected" integer;
--> statement-breakpoint
ALTER TABLE "scrape_actor_runs" ADD COLUMN "parser_version" text;
