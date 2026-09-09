import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadConfig, type ScrapedItem, type SiteConfig } from "@rta/shared";
import * as schema from "./schema.js";

const config = loadConfig();
export const pool = new Pool({ connectionString: config.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
export const db = drizzle(pool, { schema });
export { schema };

export async function verifyDatabase(): Promise<void> {
  await db.execute(sql`select 1`);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export async function persistScrapedItems(site: SiteConfig, items: ScrapedItem[]): Promise<void> {
  const [existing] = await db.select().from(schema.sites).where(eq(schema.sites.baseUrl, site.baseUrl)).limit(1);
  const databaseSite = existing ?? (await db.insert(schema.sites).values({ name: site.name, baseUrl: site.baseUrl }).returning())[0];
  if (!databaseSite) throw new Error(`could not create site ${site.name}`);

  for (const item of items) {
    await db.insert(schema.scrapedItems).values({
      siteId: databaseSite.id,
      title: item.title,
      price: item.price,
      year: item.year,
      mileage: item.mileage,
      city: item.city,
      listingUrl: item.listingUrl,
      thumbnailUrl: item.thumbnailUrl,
      rawData: item.rawData,
    }).onConflictDoUpdate({
      target: [schema.scrapedItems.siteId, schema.scrapedItems.listingUrl],
      set: {
        title: item.title,
        price: item.price,
        year: item.year,
        mileage: item.mileage,
        city: item.city,
        thumbnailUrl: item.thumbnailUrl,
        rawData: item.rawData,
        scrapedAt: new Date(),
      },
    });
  }
}
