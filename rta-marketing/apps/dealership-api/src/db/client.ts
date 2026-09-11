import dns from "node:dns";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { databaseEnv } from "../config/database.js";
import * as schema from "./schema.js";
import { logger } from "../lib/logger.js";

// Some local networks advertise unreachable IPv6 routes for Neon. Prefer the
// reachable IPv4 endpoint for every node-postgres connection.
dns.setDefaultResultOrder("ipv4first");

export const pool = new Pool({
  connectionString: databaseEnv.DATABASE_URL,
  max: databaseEnv.DATABASE_POOL_MAX,
  idleTimeoutMillis: databaseEnv.DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: databaseEnv.DATABASE_CONNECT_TIMEOUT_MS,
  application_name: "rta-api",
});

pool.on("error", (error) => {
  logger.error({ err: error }, "Unexpected PostgreSQL pool error");
});

export const db = drizzle(pool, { schema });

export async function verifyDatabaseConnection(): Promise<void> {
  await pool.query("select 1");
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
