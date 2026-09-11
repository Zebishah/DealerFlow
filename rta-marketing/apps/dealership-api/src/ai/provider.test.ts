import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../config/env.js";
import { getAiProvider } from "./provider.js";

const tool = {
  type: "function" as const,
  function: {
    name: "searchInventory",
    description: "Search active inventory",
    parameters: { type: "object", properties: { limit: { type: "integer", maximum: 8 } }, required: ["limit"] },
  },
};

function saveProviderEnv() {
  return {
    enabled: env.AI_ENABLED,
    provider: env.AI_PROVIDER,
    fallback: env.AI_FALLBACK_PROVIDERS,
    model: env.AI_MODEL,
    geminiKey: env.GEMINI_API_KEY,
    groqKey: env.GROQ_API_KEY,
    openrouterKey: env.OPENROUTER_API_KEY,
  };
}

function restoreProviderEnv(value: ReturnType<typeof saveProviderEnv>): void {
  env.AI_ENABLED = value.enabled;
  env.AI_PROVIDER = value.provider;
  env.AI_FALLBACK_PROVIDERS = value.fallback;
  env.AI_MODEL = value.model;
  env.GEMINI_API_KEY = value.geminiKey;
  env.GROQ_API_KEY = value.groqKey;
  env.OPENROUTER_API_KEY = value.openrouterKey;
}

void test("Gemini adapter uses the official endpoint, function declarations, and structured JSON", async () => {
  const saved = saveProviderEnv();
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: Record<string, unknown> | undefined;
  let requestHeaders: Headers | undefined;
  try {
    env.AI_ENABLED = true;
    env.AI_PROVIDER = "gemini";
    env.AI_FALLBACK_PROVIDERS = "";
    env.AI_MODEL = "gemini-test-model";
    env.GEMINI_API_KEY = "test-gemini-key";
    globalThis.fetch = async (input, init) => {
      requestUrl = String(input);
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requestHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"answer":"ok","sources":[],"suggestions":[],"navigation":[]}' }] } }] }), { status: 200 });
    };
    const provider = getAiProvider();
    assert.ok(provider);
    await provider.complete({ messages: [{ role: "system", content: "policy" }, { role: "user", content: "hello" }], tools: [], structuredOutput: true });
    assert.match(requestUrl, /generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-test-model:generateContent/);
    assert.doesNotMatch(requestUrl, /test-gemini-key/);
    assert.equal(requestHeaders?.get("x-goog-api-key"), "test-gemini-key");
    const generationConfig = requestBody?.generationConfig as Record<string, unknown>;
    assert.equal(generationConfig.responseMimeType, "application/json");
    assert.ok(generationConfig.responseSchema);
  } finally {
    globalThis.fetch = originalFetch;
    restoreProviderEnv(saved);
  }
});

void test("Gemini tool calls are translated into the shared completion contract", async () => {
  const saved = saveProviderEnv();
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  try {
    env.AI_ENABLED = true;
    env.AI_PROVIDER = "gemini";
    env.AI_FALLBACK_PROVIDERS = "";
    env.AI_MODEL = "gemini-test-model";
    env.GEMINI_API_KEY = "test-gemini-key";
    globalThis.fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: "searchInventory", args: { limit: 3 } } }] } }] }), { status: 200 });
    };
    const provider = getAiProvider();
    assert.ok(provider);
    const completion = await provider.complete({ messages: [{ role: "user", content: "find cars" }], tools: [tool] });
    assert.deepEqual(completion.toolCalls[0], { id: "gemini-call-0", name: "searchInventory", arguments: '{"limit":3}' });
    const tools = requestBody?.tools as Array<{ functionDeclarations: Array<{ parameters: { type: string } }> }>;
    assert.equal(tools[0]?.functionDeclarations[0]?.parameters.type, "OBJECT");
  } finally {
    globalThis.fetch = originalFetch;
    restoreProviderEnv(saved);
  }
});

void test("Groq is available as an automatic fallback without an OpenAI key", async () => {
  const saved = saveProviderEnv();
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  try {
    env.AI_ENABLED = true;
    env.AI_PROVIDER = "gemini";
    env.AI_FALLBACK_PROVIDERS = "groq";
    env.AI_MODEL = "gemini-test-model";
    env.GEMINI_API_KEY = "test-gemini-key";
    env.GROQ_API_KEY = "test-groq-key";
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      if (urls.length === 1) return new Response("unavailable", { status: 503 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "groq answer" } }] }), { status: 200 });
    };
    const provider = getAiProvider();
    assert.ok(provider);
    const completion = await provider.complete({ messages: [{ role: "user", content: "hello" }], tools: [] });
    assert.equal(completion.text, "groq answer");
    assert.match(urls[1] ?? "", /api\.groq\.com\/openai\/v1\/chat\/completions/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreProviderEnv(saved);
  }
});

void test("configured provider order is Gemini, Groq, OpenRouter before deterministic fallback", async () => {
  const saved = saveProviderEnv();
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  try {
    env.AI_ENABLED = true;
    env.AI_PROVIDER = "gemini";
    env.AI_FALLBACK_PROVIDERS = "groq,openrouter";
    env.AI_MODEL = undefined;
    env.GEMINI_API_KEY = "gemini-key";
    env.GROQ_API_KEY = "groq-key";
    env.OPENROUTER_API_KEY = "openrouter-key";
    globalThis.fetch = async (input) => {
      urls.push(String(input));
      if (urls.length < 3) return new Response("unavailable", { status: 503 });
      return new Response(JSON.stringify({ choices: [{ message: { content: "openrouter answer" } }] }), { status: 200 });
    };
    const provider = getAiProvider();
    assert.ok(provider);
    const completion = await provider.complete({ messages: [{ role: "user", content: "hello" }], tools: [] });
    assert.equal(completion.text, "openrouter answer");
    assert.match(urls[0] ?? "", /generativelanguage\.googleapis\.com/);
    assert.match(urls[1] ?? "", /api\.groq\.com\/openai\/v1/);
    assert.match(urls[2] ?? "", /openrouter\.ai\/api\/v1/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreProviderEnv(saved);
  }
});
