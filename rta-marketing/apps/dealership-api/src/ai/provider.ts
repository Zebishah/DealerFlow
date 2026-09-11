import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export type AiChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
};

export interface AiToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiCompletion {
  text: string | null;
  toolCalls: Array<{ id: string; name: string; arguments: string }>;
  provider: ProviderName;
}

export interface AiProvider {
  readonly provider: ProviderName;
  complete(input: { messages: AiChatMessage[]; tools: AiToolDefinition[]; structuredOutput?: boolean; requestId?: string }): Promise<AiCompletion>;
}

export type ProviderName = "gemini" | "groq" | "openrouter" | "openai-compatible";

const assistantAnswerJsonSchema: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    answer: { type: "STRING" },
    sources: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, kind: { type: "STRING", enum: ["product", "database", "page", "tool"] } }, required: ["label", "kind"] } },
    suggestions: { type: "ARRAY", items: { type: "STRING" } },
    navigation: { type: "ARRAY", items: { type: "OBJECT", properties: { label: { type: "STRING" }, path: { type: "STRING" } }, required: ["label", "path"] } },
  },
  required: ["answer", "sources", "suggestions", "navigation"],
};

function parseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return { value }; }
}

function toGeminiSchema(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return { type: "STRING" };
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  if (typeof input.type === "string") output.type = input.type.toUpperCase();
  if (typeof input.description === "string") output.description = input.description;
  if (Array.isArray(input.required)) output.required = input.required;
  if (Array.isArray(input.enum)) output.enum = input.enum;
  if (input.properties && typeof input.properties === "object") {
    output.properties = Object.fromEntries(Object.entries(input.properties as Record<string, unknown>).map(([key, child]) => [key, toGeminiSchema(child)]));
  }
  if (input.items) output.items = toGeminiSchema(input.items);
  return output;
}

function geminiFunctionDeclarations(tools: AiToolDefinition[]): Array<Record<string, unknown>> {
  return tools.map((tool) => ({ name: tool.function.name, description: tool.function.description, parameters: toGeminiSchema(tool.function.parameters) }));
}

function geminiContents(messages: AiChatMessage[]): Array<Record<string, unknown>> {
  const toolNames = new Map<string, string>();
  for (const message of messages) {
    for (const call of message.tool_calls ?? []) toolNames.set(call.id, call.function.name);
  }
  return messages.filter((message) => message.role !== "system").map((message) => {
    if (message.role === "tool") {
      const response = parseJson(message.content);
      return { role: "user", parts: [{ functionResponse: { name: toolNames.get(message.tool_call_id ?? "") ?? "assistant_tool", response: response && typeof response === "object" ? response : { result: response } } }] };
    }
    if (message.role === "assistant") {
      const parts: Array<Record<string, unknown>> = [];
      if (message.content) parts.push({ text: message.content });
      for (const call of message.tool_calls ?? []) parts.push({ functionCall: { name: call.function.name, args: parseJson(call.function.arguments) } });
      return { role: "model", parts: parts.length ? parts : [{ text: "" }] };
    }
    return { role: "user", parts: [{ text: message.content }] };
  });
}

class GeminiProvider implements AiProvider {
  readonly provider = "gemini" as const;
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async complete(input: { messages: AiChatMessage[]; tools: AiToolDefinition[]; structuredOutput?: boolean; requestId?: string }): Promise<AiCompletion> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const systemMessage = input.messages.find((message) => message.role === "system");
    const generationConfig: Record<string, unknown> = { temperature: 0.1, maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS };
    if (input.structuredOutput && input.tools.length === 0) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = assistantAnswerJsonSchema;
    }
    const body: Record<string, unknown> = {
      systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
      contents: geminiContents(input.messages),
      tools: input.tools.length ? [{ functionDeclarations: geminiFunctionDeclarations(input.tools) }] : undefined,
      toolConfig: input.tools.length ? { functionCallingConfig: { mode: "AUTO" } } : undefined,
      generationConfig,
    };
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Gemini provider returned HTTP ${response.status}`);
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown; functionCall?: { name?: unknown; args?: unknown; id?: unknown } }> } }> };
    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const toolCalls = parts.filter((part) => typeof part.functionCall?.name === "string").map((part, index) => ({ id: typeof part.functionCall?.id === "string" ? part.functionCall.id : `gemini-call-${index}`, name: part.functionCall!.name as string, arguments: JSON.stringify(part.functionCall?.args ?? {}) }));
    const text = parts.filter((part) => typeof part.text === "string").map((part) => part.text as string).join("\n");
    return { text: text || null, toolCalls, provider: this.provider };
  }
}

class OpenAiCompatibleProvider implements AiProvider {
  constructor(readonly provider: ProviderName, private readonly apiKey: string, private readonly baseUrl: string, private readonly model: string, private readonly headers: Record<string, string> = {}) {}

  async complete(input: { messages: AiChatMessage[]; tools: AiToolDefinition[]; structuredOutput?: boolean; requestId?: string }): Promise<AiCompletion> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", ...this.headers },
      body: JSON.stringify({ model: this.model, messages: input.messages, tools: input.tools.length ? input.tools : undefined, tool_choice: input.tools.length ? "auto" : undefined, response_format: input.structuredOutput && input.tools.length === 0 ? { type: "json_object" } : undefined, temperature: 0.1, max_tokens: env.AI_MAX_OUTPUT_TOKENS }),
      signal: AbortSignal.timeout(env.AI_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
    const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown; tool_calls?: Array<{ id?: unknown; function?: { name?: unknown; arguments?: unknown } }> } }> };
    const message = payload.choices?.[0]?.message;
    const toolCalls = (message?.tool_calls ?? []).filter((call) => typeof call.id === "string" && typeof call.function?.name === "string" && typeof call.function.arguments === "string").map((call) => ({ id: call.id as string, name: call.function!.name as string, arguments: call.function!.arguments as string }));
    return { text: typeof message?.content === "string" ? message.content : null, toolCalls, provider: this.provider };
  }
}

class FallbackProvider implements AiProvider {
  constructor(private readonly providers: AiProvider[]) {}
  readonly provider = "openai-compatible" as const;

  async complete(input: { messages: AiChatMessage[]; tools: AiToolDefinition[]; structuredOutput?: boolean; requestId?: string }): Promise<AiCompletion> {
    let lastError: unknown;
    for (const provider of this.providers) {
      try { return await provider.complete(input); } catch (error) {
        lastError = error;
        logger.warn({ event: "assistant_provider_failure", requestId: input.requestId, provider: provider.provider }, "Assistant provider failed; trying the next configured provider");
      }
    }
    throw lastError instanceof Error ? lastError : new Error("No configured AI provider is available");
  }
}

function modelFor(provider: ProviderName, primary: boolean): string {
  if (primary && env.AI_MODEL) return env.AI_MODEL;
  if (provider === "gemini") return env.GEMINI_MODEL;
  if (provider === "groq") return env.GROQ_MODEL;
  if (provider === "openrouter") return env.OPENROUTER_MODEL;
  return env.AI_MODEL ?? "gpt-4o-mini";
}

function createProvider(provider: ProviderName, primary: boolean): AiProvider | null {
  const model = modelFor(provider, primary);
  if (provider === "gemini" && env.GEMINI_API_KEY) return new GeminiProvider(env.GEMINI_API_KEY, model);
  if (provider === "groq" && env.GROQ_API_KEY) return new OpenAiCompatibleProvider("groq", env.GROQ_API_KEY, "https://api.groq.com/openai/v1", model);
  if (provider === "openrouter" && env.OPENROUTER_API_KEY) {
    const headers: Record<string, string> = {};
    if (env.OPENROUTER_HTTP_REFERER) headers["HTTP-Referer"] = env.OPENROUTER_HTTP_REFERER;
    if (env.OPENROUTER_APP_TITLE) headers["X-Title"] = env.OPENROUTER_APP_TITLE;
    return new OpenAiCompatibleProvider("openrouter", env.OPENROUTER_API_KEY, "https://openrouter.ai/api/v1", model, headers);
  }
  if (provider === "openai-compatible" && env.AI_API_KEY) return new OpenAiCompatibleProvider("openai-compatible", env.AI_API_KEY, env.AI_BASE_URL, model);
  return null;
}

export function getAiProvider(): AiProvider | null {
  if (!env.AI_ENABLED || env.AI_PROVIDER === "none") return null;
  const configured = [env.AI_PROVIDER, ...env.AI_FALLBACK_PROVIDERS.split(",").map((value) => value.trim()).filter(Boolean)] as ProviderName[];
  const providers = configured.filter((provider, index, all) => all.indexOf(provider) === index).map((provider, index) => createProvider(provider, index === 0)).filter((provider): provider is AiProvider => Boolean(provider));
  if (!providers.length) return null;
  return providers.length === 1 ? providers[0]! : new FallbackProvider(providers);
}
