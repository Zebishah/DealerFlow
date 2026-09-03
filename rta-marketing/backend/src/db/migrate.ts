import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_MIGRATION_URL;

if (!connectionString) {
  throw new Error("DATABASE_MIGRATION_URL is required for database migrations");
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
});

const db = drizzle(pool);

async function main(): Promise<void> {
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Database migrations completed");
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("Database migration failed", error);
  process.exitCode = 1;
});
