import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const sites = pgTable("sites", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scrapedItems = pgTable("scraped_items", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  siteId: integer("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  price: text("price"),
  year: text("year"),
  mileage: text("mileage"),
  city: text("city"),
  listingUrl: text("listing_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  scrapedAt: timestamp("scraped_at", { withTimezone: true }).defaultNow().notNull(),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull().default({}),
}, (table) => ({
  siteListingUnique: uniqueIndex("scraped_items_site_listing_unique").on(table.siteId, table.listingUrl),
}));
