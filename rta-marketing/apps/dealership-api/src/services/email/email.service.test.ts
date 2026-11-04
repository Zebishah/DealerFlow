import assert from "node:assert/strict";
import test from "node:test";
import { logger } from "../../lib/logger.js";
import { addressEmail, createEmailService, EmailServiceError, sendEmailSafely } from "./email.service.js";
import { accessApprovedEmail, accessDecisionEmail, accessRequestAdminEmail, accessRequestReceivedEmail, passwordResetEmail, verificationEmail } from "./templates.js";
import type { EmailUseCase, TransactionalEmail } from "./email.types.js";

const config = { apiKey: "server-only-test-key", from: "verified@example.com", fromName: "RTA Test" };

void test("Resend receives Bearer authentication and its sender, recipient, body, and tag schema", async () => {
  let request: { url: string; init?: RequestInit | undefined } | undefined;
  const service = createEmailService(config, async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ id: "test-message" }), { status: 200 });
  });
  const template = verificationEmail("Ada", "https://example.com/verify?token=opaque", 45);
  await service.send(addressEmail(template, { email: "ada@example.com", name: "Ada" }), "verify_email");

  assert.equal(request?.url, "https://api.resend.com/emails");
  assert.equal(request?.init?.method, "POST");
  const headers = new Headers(request?.init?.headers);
  assert.equal(headers.get("authorization"), "Bearer server-only-test-key");
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.has("api-key"), false);
  assert.ok(request?.init?.signal instanceof AbortSignal);
  const body = String(request?.init?.body);
  assert.equal(body.includes("server-only-test-key"), false);
  assert.deepEqual(JSON.parse(body), { from: "RTA Test <verified@example.com>", to: ["Ada <ada@example.com>"], subject: template.subject, html: template.htmlContent, text: template.textContent, tags: [{ name: "use_case", value: "verify_email" }] });
});

void test("recipient names with punctuation and line breaks remain valid mailbox strings", async () => {
  let body: { to: string[]; tags: unknown } | undefined;
  const service = createEmailService(config, async (_url, init) => {
    body = JSON.parse(String(init?.body)) as typeof body;
    return new Response(null, { status: 200 });
  });
  await service.send({ to: [{ email: "jane@example.com", name: "Doe, Jane" }, { email: "ada@example.com", name: "Ada\r\nLovelace" }, { email: "plain@example.com" }], subject: "RTA", htmlContent: "<p>Example</p>", textContent: "Example" }, "password_reset");
  assert.deepEqual(body?.to, ['"Doe, Jane" <jane@example.com>', "Ada Lovelace <ada@example.com>", "plain@example.com"]);
  assert.deepEqual(body?.tags, [{ name: "use_case", value: "password_reset" }]);
});

void test("all account and access templates are delivered through the same Resend adapter", async () => {
  const messages: Array<[EmailUseCase, Omit<TransactionalEmail, "to">]> = [
    ["verify_email", verificationEmail("Ada", "https://example.com/verify", 45)],
    ["resend_verification", verificationEmail("Ada", "https://example.com/verify", 45, "resend_verification")],
    ["password_reset", passwordResetEmail("Ada", "https://example.com/reset", 30)],
    ["access_request_received", accessRequestReceivedEmail("Ada")],
    ["access_request_admin", accessRequestAdminEmail({ name: "Ada", company: "Example", email: "ada@example.com", platformScope: "dealership", permissions: "view", reason: "Evaluate", duration: "3 days", url: "https://example.com/review" })],
    ["access_approved", accessApprovedEmail({ name: "Ada", permissions: "view", expiresAt: "2026-11-08", setupUrl: "https://example.com/setup", loginUrl: "https://example.com/login", scrapingUrl: "https://example.com/data", invitation: true })],
    ["access_rejected", accessDecisionEmail("rejected", "Ada", "Request update")],
    ["access_revoked", accessDecisionEmail("revoked", "Ada", "Access update")],
    ["access_extended", accessDecisionEmail("extended", "Ada", "Access extended")],
  ];
  const sent: Array<Record<string, unknown>> = [];
  const service = createEmailService(config, async (_url, init) => {
    sent.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(null, { status: 200 });
  });
  for (const [useCase, template] of messages) {
    await service.send(addressEmail(template, { email: "ada@example.com" }), useCase);
    const payload = sent.at(-1)!;
    assert.equal(payload.html, template.htmlContent);
    assert.equal(payload.text, template.textContent);
    assert.deepEqual(payload.tags, [{ name: "use_case", value: useCase }]);
  }
  assert.equal(sent.length, 9);
});

void test("missing configuration fails before contacting the provider", async () => {
  let requests = 0;
  for (const incomplete of [{ from: config.from, fromName: config.fromName }, { apiKey: config.apiKey, fromName: config.fromName }, { ...config, apiKey: " " }]) {
    const service = createEmailService(incomplete, async () => { requests++; return new Response(); });
    await assert.rejects(() => service.send(addressEmail(verificationEmail("Ada", "https://example.com/verify", 45), { email: "ada@example.com" }), "verify_email"), { code: "EMAIL_NOT_CONFIGURED" });
  }
  assert.equal(requests, 0);
});

void test("provider rejection and network timeouts stay recoverable without logging keys or message contents", async (context) => {
  const logs: unknown[][] = [];
  context.mock.method(logger, "warn", (...args: unknown[]) => { logs.push(args); });
  const message = addressEmail(verificationEmail("Ada", "https://example.com/verify?token=private-email-token", 45), { email: "ada@example.com" });
  for (const status of [400, 401, 403, 429, 500, 503]) {
    const service = createEmailService(config, async () => new Response("private-email-token server-only-test-key", { status }));
    await assert.rejects(() => service.send(message, "verify_email"), (error: unknown) => error instanceof EmailServiceError && error.code === "EMAIL_PROVIDER_FAILED");
  }
  const service = createEmailService(config, async () => { const error = new Error("private-email-token server-only-test-key"); error.name = "TimeoutError"; throw error; });
  await assert.rejects(() => service.send(message, "verify_email"), { code: "EMAIL_PROVIDER_FAILED" });
  const logText = JSON.stringify(logs);
  assert.equal(logText.includes("private-email-token"), false);
  assert.equal(logText.includes("server-only-test-key"), false);
});

void test("the safe wrapper keeps failed email delivery recoverable without making a real send", async (context) => {
  // Even if the developer has a real key in their environment, this test never sends email.
  context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
  const result = await sendEmailSafely(addressEmail(verificationEmail("Ada", "https://example.com/verify", 45), { email: "ada@example.com" }), "verify_email");
  assert.equal(result, false);
});
