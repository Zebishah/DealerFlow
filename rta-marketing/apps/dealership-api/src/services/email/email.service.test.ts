import assert from "node:assert/strict";
import test from "node:test";
import { addressEmail, createEmailService, sendEmailSafely } from "./email.service.js";
import { verificationEmail } from "./templates.js";

void test("Brevo email service sends HTTPS JSON without exposing the key in the payload", async () => {
  let request: { url: string; init?: RequestInit | undefined } | undefined;
  const service = createEmailService({ apiKey: "server-only-test-key", from: "verified@example.com", fromName: "RTA Test" }, async (url, init) => {
    request = { url: String(url), init };
    return new Response(JSON.stringify({ messageId: "test-message" }), { status: 201 });
  });
  await service.send(addressEmail(verificationEmail("Ada", "https://example.com/verify?token=opaque", 45), { email: "ada@example.com", name: "Ada" }), "verify_email");
  assert.equal(request?.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(new Headers(request?.init?.headers).get("api-key"), "server-only-test-key");
  assert.equal(JSON.stringify(request?.init?.body).includes("server-only-test-key"), false);
});

void test("email provider failures are recoverable and return false through the safe wrapper", async () => {
  const result = await sendEmailSafely(addressEmail(verificationEmail("Ada", "https://example.com/verify", 45), { email: "ada@example.com" }), "verify_email");
  assert.equal(result, false);
});
