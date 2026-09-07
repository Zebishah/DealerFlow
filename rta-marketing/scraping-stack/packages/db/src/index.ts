import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { loadConfig } from "@rta/shared";
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
