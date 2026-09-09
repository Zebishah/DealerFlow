import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { databaseEnv } from "../config/database.js";

const migrationPool = new Pool({
  connectionString:
    databaseEnv.DATABASE_MIGRATION_URL ?? databaseEnv.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15_000,
  application_name: "rta-migrations",
});

const migrationDb = drizzle(migrationPool);

async function main(): Promise<void> {
  try {
    await migrate(migrationDb, {
      migrationsFolder: "drizzle",
    });

    console.log("Database migrations completed");
  } finally {
    await migrationPool.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Database migration failed", error);
  process.exitCode = 1;
});
