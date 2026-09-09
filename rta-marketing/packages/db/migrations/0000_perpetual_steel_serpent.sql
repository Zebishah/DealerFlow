CREATE TABLE "scraped_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scraped_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"site_id" integer NOT NULL,
	"title" text NOT NULL,
	"price" text,
	"link" text NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sites_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_base_url_unique" UNIQUE("base_url")
);
--> statement-breakpoint
ALTER TABLE "scraped_items" ADD CONSTRAINT "scraped_items_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scraped_items_site_link_unique" ON "scraped_items" USING btree ("site_id","link");