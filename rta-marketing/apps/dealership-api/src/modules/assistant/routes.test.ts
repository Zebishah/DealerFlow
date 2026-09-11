import assert from "node:assert/strict";
import express from "express";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createAssistantRouter } from "./routes.js";

async function withAssistantLimits(options: { rateLimitMax: number; dailyQuota: number }, assertion: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use(createAssistantRouter(options));
  const server: Server = createServer(app);
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Assistant test server did not start");
  try {
    await assertion(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function post(baseUrl: string): Promise<Response> {
  return fetch(`${baseUrl}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: "What does RTA do?" }) });
}

void test("assistant short-window rate limiting is enforced", async () => {
  await withAssistantLimits({ rateLimitMax: 2, dailyQuota: 100 }, async (baseUrl) => {
    assert.equal((await post(baseUrl)).status, 200);
    assert.equal((await post(baseUrl)).status, 200);
    const blocked = await post(baseUrl);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json() as { error: { code: string } }).error.code, "AI_RATE_LIMITED");
  });
});

void test("assistant daily quota is enforced independently of the short window", async () => {
  await withAssistantLimits({ rateLimitMax: 100, dailyQuota: 2 }, async (baseUrl) => {
    assert.equal((await post(baseUrl)).status, 200);
    assert.equal((await post(baseUrl)).status, 200);
    const blocked = await post(baseUrl);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json() as { error: { code: string } }).error.code, "AI_DAILY_QUOTA_EXCEEDED");
  });
});
