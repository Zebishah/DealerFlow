ALTER TABLE "scraped_items" RENAME COLUMN "link" TO "listing_url";
ALTER TABLE "scraped_items" ADD COLUMN "year" text;
ALTER TABLE "scraped_items" ADD COLUMN "mileage" text;
ALTER TABLE "scraped_items" ADD COLUMN "city" text;
ALTER TABLE "scraped_items" ADD COLUMN "thumbnail_url" text;
DROP INDEX "scraped_items_site_link_unique";
CREATE UNIQUE INDEX "scraped_items_site_listing_unique" ON "scraped_items" USING btree ("site_id", "listing_url");
