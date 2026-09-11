import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createApp } from "./app.js";
import { hashPassword } from "./auth/password.js";
import { pool } from "./db/client.js";

interface TestServer {
  baseUrl: string;
  close(): Promise<void>;
}

async function startTestServer(): Promise<TestServer> {
  const server: Server = createServer(createApp());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not expose a TCP address");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

async function withServer(
  assertion: (server: TestServer) => Promise<void>,
): Promise<void> {
  const server = await startTestServer();
  try {
    await assertion(server);
  } finally {
    await server.close();
  }
}

void test("liveness and public capabilities expose stable API contracts", async () => {
  await withServer(async ({ baseUrl }) => {
    const liveResponse = await fetch(`${baseUrl}/health/live`);
    assert.equal(liveResponse.status, 200);
    assert.deepEqual(await liveResponse.json(), { status: "ok" });

    const capabilitiesResponse = await fetch(
      `${baseUrl}/api/v1/auth/capabilities`,
    );
    assert.equal(capabilitiesResponse.status, 200);
    assert.deepEqual(await capabilitiesResponse.json(), {
      data: {
        demoMode: true,
        liveScrapingAllowed: false,
        defaultScrapeMode: "fixture",
        recruiterDemoAvailable: false,
      },
    });
  });
});

void test("CORS accepts configured origins and request IDs round-trip", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/capabilities`, {
      headers: {
        origin: "http://localhost:5173",
        "x-request-id": "contract-test-request",
      },
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );
    assert.equal(
      response.headers.get("access-control-allow-credentials"),
      "true",
    );
    assert.equal(response.headers.get("x-request-id"), "contract-test-request");
  });
});

void test("CORS rejects unknown browser origins with a safe 403 contract", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/capabilities`, {
      headers: { origin: "https://untrusted.example" },
    });
    assert.equal(response.status, 403);
    const payload = (await response.json()) as {
      error: { code: string };
    };
    assert.equal(payload.error.code, "CORS_ORIGIN_DENIED");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
  });
});

void test("unknown endpoints return the documented safe error envelope", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/v1/not-a-route`);
    assert.equal(response.status, 404);
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(payload.error.code, "ROUTE_NOT_FOUND");
    assert.match(payload.error.message, /GET \/api\/v1\/not-a-route/);
  });
});

void test("access requests reject malformed public submissions before persistence", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/v1/access-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", reason: "too short" }),
    });
    assert.equal(response.status, 400);
  });
});

void test("public assistant answers from curated knowledge without authentication", async () => {
  await withServer(async ({ baseUrl }) => {
    const response = await fetch(`${baseUrl}/api/v1/assistant/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "How is the platform secured?", context: { route: "/login" } }),
    });
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { data: { answer: string; sources: Array<{ kind: string }> } };
    assert.match(payload.data.answer, /security|access|session/i);
    assert.ok(payload.data.sources.some((source) => source.kind === "product"));
  });
});

void test("intelligence and acquisition endpoints reject unauthenticated access", async () => {
  await withServer(async ({ baseUrl }) => {
    const endpoints = [
      "/api/v1/dashboard/summary",
      "/api/v1/vehicles",
      "/api/v1/scrape-runs",
      "/api/v1/sources",
    ];

    for (const endpoint of endpoints) {
      const response = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(response.status, 401, endpoint);
      const payload = (await response.json()) as { error: { code: string } };
      assert.equal(payload.error.code, "AUTH_REQUIRED", endpoint);
    }

    const createRun = await fetch(`${baseUrl}/api/v1/scrape-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filters: {}, mode: "fixture" }),
    });
    assert.equal(createRun.status, 401);
    const payload = (await createRun.json()) as { error: { code: string } };
    assert.equal(payload.error.code, "AUTH_REQUIRED");
  });
});

void test(
  "login endpoint applies a stricter failed-attempt limit",
  { skip: process.env.RUN_DATABASE_TESTS !== "true" },
  async () => {
    await withServer(async ({ baseUrl }) => {
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "missing-user@rta.test",
            password: "incorrect-password",
          }),
        });
        assert.equal(response.status, 401);
      }

      const blocked = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "missing-user@rta.test",
          password: "incorrect-password",
        }),
      });
      assert.equal(blocked.status, 429);
      const payload = (await blocked.json()) as {
        error: { code: string };
      };
      assert.equal(payload.error.code, "LOGIN_RATE_LIMITED");
    });
  },
);

void test(
  "authenticated lead creation is idempotent through the HTTP boundary",
  { skip: process.env.RUN_DATABASE_TESTS !== "true" },
  async () => {
    const workspaceId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const email = `integration-${crypto.randomUUID()}@rta.test`;
    const password = "Integration-password-123";

    await pool.query(
      `insert into workspaces (id, slug, name, mode)
       values ($1, $2, $3, 'demo')`,
      [workspaceId, `integration-${workspaceId}`, "HTTP integration"],
    );
    await pool.query(
      `insert into users
         (id, workspace_id, email, password_hash, first_name, last_name, role)
       values ($1, $2, $3, $4, 'API', 'Tester', 'admin')`,
      [userId, workspaceId, email, hashPassword(password)],
    );

    try {
      await withServer(async ({ baseUrl }) => {
        const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        assert.equal(loginResponse.status, 200);

        const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
        assert.ok(cookie);
        const loginPayload = (await loginResponse.json()) as {
          data: { csrfToken: string };
        };

        const leadBody = {
          firstName: "Ida",
          lastName: "Potent",
          email: "ida.potent@example.test",
          vehicleInterest: "2024 Volkswagen Golf",
          status: "qualified",
        };
        const idempotencyKey = `lead-${crypto.randomUUID()}`;
        const createLead = () =>
          fetch(`${baseUrl}/api/v1/dealership/leads`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie,
              "x-csrf-token": loginPayload.data.csrfToken,
              "idempotency-key": idempotencyKey,
            },
            body: JSON.stringify(leadBody),
          });

        const createdResponse = await createLead();
        assert.equal(createdResponse.status, 201);
        const created = (await createdResponse.json()) as {
          data: { id: string };
          meta: { idempotentReplay: boolean };
        };
        assert.equal(created.meta.idempotentReplay, false);

        const replayResponse = await createLead();
        assert.equal(replayResponse.status, 200);
        const replayed = (await replayResponse.json()) as {
          data: { id: string };
          meta: { idempotentReplay: boolean };
        };
        assert.equal(replayed.data.id, created.data.id);
        assert.equal(replayed.meta.idempotentReplay, true);

        const count = await pool.query<{ count: number }>(
          `select count(*)::int as count
             from leads
            where workspace_id = $1 and email = $2`,
          [workspaceId, leadBody.email],
        );
        assert.equal(count.rows[0]?.count, 1);
      });
    } finally {
      await pool.query("delete from sessions where user_id = $1", [userId]);
      await pool.query("delete from idempotency_records where workspace_id = $1", [
        workspaceId,
      ]);
      await pool.query("delete from audit_events where workspace_id = $1", [
        workspaceId,
      ]);
      await pool.query("delete from leads where workspace_id = $1", [workspaceId]);
      await pool.query("delete from users where id = $1", [userId]);
      await pool.query("delete from workspaces where id = $1", [workspaceId]);
    }
  },
);

void test(
  "employee document metadata lists without S3 configuration",
  { skip: process.env.RUN_DATABASE_TESTS !== "true" },
  async () => {
    const workspaceId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    const email = `documents-${crypto.randomUUID()}@rta.test`;
    const password = "Integration-password-123";
    await pool.query(
      `insert into workspaces (id, slug, name, mode) values ($1, $2, 'Document test', 'demo')`,
      [workspaceId, `documents-${workspaceId}`],
    );
    await pool.query(
      `insert into users (id, workspace_id, email, password_hash, role)
       values ($1, $2, $3, $4, 'admin')`,
      [userId, workspaceId, email, hashPassword(password)],
    );
    await pool.query(
      `insert into employee_documents
         (id, workspace_id, user_id, uploaded_by_user_id, kind, file_name, mime_type, size_bytes, storage_key)
       values ($1, $2, $3, $3, 'insurance', 'sanitized.pdf', 'application/pdf', 1024, $4)`,
      [documentId, workspaceId, userId, `documents/${workspaceId}/${userId}/sanitized.pdf`],
    );
    try {
      await withServer(async ({ baseUrl }) => {
        const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        assert.equal(login.status, 200);
        const cookie = login.headers.get("set-cookie")?.split(";")[0];
        assert.ok(cookie);
        const response = await fetch(`${baseUrl}/api/v1/dealership/documents`, {
          headers: { cookie },
        });
        assert.equal(response.status, 200);
        const payload = (await response.json()) as { data: Array<{ id: string }> };
        assert.deepEqual(payload.data.map((document) => document.id), [documentId]);
      });
    } finally {
      await pool.query("delete from sessions where user_id = $1", [userId]);
      await pool.query("delete from employee_documents where id = $1", [documentId]);
      await pool.query("delete from users where id = $1", [userId]);
      await pool.query("delete from workspaces where id = $1", [workspaceId]);
    }
  },
);
