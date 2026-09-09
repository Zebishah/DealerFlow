import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { pool } from "./client.js";

function postgresErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "string" ? error.code : undefined;
}

async function expectUniqueViolation(operation: () => Promise<unknown>) {
  await assert.rejects(
    operation,
    (error: unknown) => postgresErrorCode(error) === "23505",
  );
}

void test(
  "PostgreSQL enforces case-insensitive users and idempotent acquisition keys",
  { skip: process.env.RUN_DATABASE_TESTS !== "true" },
  async () => {
    const client: PoolClient = await pool.connect();
    try {
      await client.query("begin");

      const workspace = await client.query<{ id: string }>(
        `insert into workspaces (slug, name, mode)
         values ($1, $2, 'demo')
         returning id`,
        [`integration-${crypto.randomUUID()}`, "Integration workspace"],
      );
      const workspaceId = workspace.rows[0]?.id;
      assert.ok(workspaceId);

      await client.query(
        `insert into users (workspace_id, email, password_hash, role)
         values ($1, $2, $3, 'admin')`,
        [workspaceId, "CaseSensitive@rta.test", "integration-test-hash"],
      );

      await expectUniqueViolation(() =>
        client.query(
          `insert into users (workspace_id, email, password_hash, role)
           values ($1, $2, $3, 'viewer')`,
          [workspaceId, "casesensitive@rta.test", "another-test-hash"],
        ),
      );

      await client.query("rollback");
      await client.query("begin");

      const idempotencyKey = `integration-${crypto.randomUUID()}`;
      await client.query(
        `insert into scrape_runs (idempotency_key, mode, filters)
         values ($1, 'fixture', '{}'::jsonb)`,
        [idempotencyKey],
      );

      await expectUniqueViolation(() =>
        client.query(
          `insert into scrape_runs (idempotency_key, mode, filters)
           values ($1, 'fixture', '{}'::jsonb)`,
          [idempotencyKey],
        ),
      );
    } finally {
      await client.query("rollback").catch(() => undefined);
      client.release();
    }
  },
);
