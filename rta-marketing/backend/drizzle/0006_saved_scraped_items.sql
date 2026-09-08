CREATE TABLE "saved_scraped_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"scraped_item_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_scraped_items" ADD CONSTRAINT "saved_scraped_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saved_scraped_items" ADD CONSTRAINT "saved_scraped_items_scraped_item_id_scraped_items_id_fk" FOREIGN KEY ("scraped_item_id") REFERENCES "public"."scraped_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "saved_scraped_items_user_item_uq" ON "saved_scraped_items" USING btree ("user_id","scraped_item_id");
--> statement-breakpoint
CREATE INDEX "saved_scraped_items_user_idx" ON "saved_scraped_items" USING btree ("user_id","created_at");
