import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createApp } from "./app.js";

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
