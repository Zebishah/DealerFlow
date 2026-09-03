import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pool, db } from "./client.js";

async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: "drizzle" });
  await pool.end();
  console.log("Database migrations completed");
}

void main().catch(async (error) => {
  console.error("Database migration failed", error);
  await pool.end();
  process.exitCode = 1;
});
