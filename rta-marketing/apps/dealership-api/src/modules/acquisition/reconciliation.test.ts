import assert from "node:assert/strict";
import test from "node:test";
import { ApifyClientError, type ApifyClient, type ApifyRun } from "./apify-client.js";
import { reconcileStuckApifyRuns, type ActorRunRepository, type ActorRunRow } from "./reconciliation.js";

function row(overrides: Partial<ActorRunRow> = {}): ActorRunRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    apifyRunId: "run-1",
    siteId: 1,
    siteKey: "romans-international",
    requestedLimit: 5,
    status: "scraping",
    progressStage: "details",
    foundCount: null,
    durationMs: null,
    timings: null,
    startedAt: new Date("2026-09-19T00:00:00.000Z"),
    finishedAt: null,
    lastError: null,
    createdAt: new Date("2026-09-19T00:00:00.000Z"),
    updatedAt: new Date("2026-09-19T00:00:00.000Z"),
    ...overrides,
  };
}

function client(remote: ApifyRun, output?: { foundCount?: number; durationMs?: number }): ApifyClient {
  return {
    getRun: async () => remote,
    getOutput: async () => output ?? {},
  } as unknown as ApifyClient;
}

function repository(initial: ActorRunRow): { repository: ActorRunRepository; updates: ActorRunRow[] } {
  const updates: ActorRunRow[] = [];
  return {
    updates,
    repository: {
      findStuck: async () => [initial],
      update: async (_id, values) => {
        const updated = { ...initial, ...values } as ActorRunRow;
        updates.push(updated);
        return updated;
      },
    },
  };
}

void test("reconciliation moves a stale running run to completed and records output metadata", async () => {
  const now = Date.parse("2026-09-19T01:00:00.000Z");
  const setup = repository(row({ updatedAt: new Date(now - 600_000) }));
  const result = await reconcileStuckApifyRuns({
    repository: setup.repository,
    client: client({ id: "run-1", status: "SUCCEEDED", finishedAt: "2026-09-19T00:59:00.000Z", defaultKeyValueStoreId: "store-1" }, { foundCount: 5, durationMs: 42 }),
    now,
    staleMs: 300_000,
  });
  assert.deepEqual(result, { examined: 1, reconciled: 1, stillActive: 0, failed: 0, errors: [] });
  assert.equal(setup.updates[0]?.status, "completed");
  assert.equal(setup.updates[0]?.foundCount, 5);
});

void test("reconciliation moves a stale run to failed when Apify reports failure", async () => {
  const now = Date.parse("2026-09-19T01:00:00.000Z");
  const setup = repository(row({ updatedAt: new Date(now - 600_000) }));
  const result = await reconcileStuckApifyRuns({
    repository: setup.repository,
    client: client({ id: "run-1", status: "FAILED" }),
    now,
    staleMs: 300_000,
  });
  assert.equal(result.reconciled, 1);
  assert.equal(setup.updates[0]?.status, "failed");
  assert.equal(setup.updates[0]?.lastError, "The Apify Actor run failed.");
});

void test("still-running remote runs remain unchanged and are safe to reconcile repeatedly", async () => {
  const now = Date.parse("2026-09-19T01:00:00.000Z");
  const setup = repository(row({ updatedAt: new Date(now - 600_000) }));
  const result = await reconcileStuckApifyRuns({ repository: setup.repository, client: client({ id: "run-1", status: "RUNNING" }), now, staleMs: 300_000 });
  assert.deepEqual(result, { examined: 1, reconciled: 0, stillActive: 1, failed: 0, errors: [] });
  assert.equal(setup.updates.length, 0);
});

void test("unknown remote runs and Apify outages are reported without starting a new run", async () => {
  const now = Date.parse("2026-09-19T01:00:00.000Z");
  const setup = repository(row({ updatedAt: new Date(now - 600_000) }));
  const result = await reconcileStuckApifyRuns({
    repository: setup.repository,
    client: { getRun: async () => { throw new ApifyClientError("missing", "not-found"); } } as unknown as ApifyClient,
    now,
    staleMs: 300_000,
  });
  assert.equal(result.failed, 1);
  assert.equal(result.errors[0]?.kind, "not-found");
  assert.equal(setup.updates.length, 0);
});
