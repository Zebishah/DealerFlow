# RTA Assistant architecture

The site-wide assistant is a read-only product and dealership operations
surface. It is available in the main dealership web app and the separate
scraping monitor through the shared `@rta/assistant-ui` package.

## Request flow

```text
Browser context + bounded history
        |
        v
POST /api/v1/assistant/chat
        |
        +--> session / CSRF / rate limit / request validation
        |
        +--> curated knowledge + authorized deterministic tools
        |          |
        |          +--> workspace, role, and row visibility checks
        |          +--> actual inventory and scraping records only
        |
        +--> optional Gemini -> Groq -> OpenRouter provider chain
                   |
                   +--> validated tool arguments and answer envelope
```

When `AI_ENABLED=false` or the provider is unavailable, the endpoint remains
useful: product questions use curated knowledge and operational questions use
the deterministic tool router. This keeps local development and CI independent
of a paid provider.

## Safety boundaries

- Public requests expose only curated product, architecture, security, demo,
  and workflow knowledge.
- Authenticated tools require the existing opaque session, CSRF token, role
  checks, and workspace scope. Employees see only assigned leads/sales; viewer
  and virtual-assistant roles do not receive sales data.
- Inventory answers come from active persisted listings. The assistant cannot
  invent vehicles or browse arbitrary URLs.
- Scraping tools report source/run state only. They cannot trigger a scrape,
  send email, change a record, approve access, or mutate a queue.
- User messages, history, listing fields, notes, and scraped text are treated as
  untrusted data. They are never allowed to override the system policy.
- Input length, history length, output tokens, request timeout, and per-user/IP
  rate limits are bounded. Logs record provider/tool failure metadata, not
  prompts, secrets, or returned customer contact fields.
- Lead intelligence uses lead status/timestamps only; vehicle intelligence uses
  active persisted listings; market-price explanations are explicitly limited
  to same-make/model/year inventory comparables; scraping troubleshooting is
  diagnostic and manual-only.
- Benchmark responses expose only the selected provider name. Structured logs
  correlate provider attempts, fallback events, tool success, validation
  failure, and authorization denial with the request ID without logging
  prompts, arguments, tool results, or secrets.

## Extending the assistant

Add a tool only when its input and output can be expressed with a strict Zod
schema and its query can enforce the same authorization rules as the regular
API route. Add a curated knowledge entry for stable product facts. Keep
deterministic calculations in SQL/service code and use the model for intent,
explanation, and summarization rather than arithmetic or authorization.

The provider layer supports the official Gemini Developer API, Groq's
OpenAI-compatible endpoint, OpenRouter's OpenAI-compatible endpoint, and an
explicit custom OpenAI-compatible option. Gemini is the recommended free-tier
provider. A future provider can implement the small `AiProvider` interface
without changing the UI, tool registry, or security boundary.

## Portfolio / resume achievements

- Designed and implemented a production-oriented, page-aware AI assistant
  across public, authenticated dealership, and scraping-monitor surfaces.
- Built a provider-neutral orchestration layer with strict Zod contracts,
  bounded context, deterministic fallbacks, tool-call limits, timeout control,
  and graceful provider failure handling.
- Connected natural-language questions to authorization-preserving PostgreSQL
  tools for dashboard, analytics, lead next actions, inventory recommendations,
  listing comparisons, market-price explanations, sales performance, and
  scraping troubleshooting while
  keeping mutations out of the AI boundary.
- Added public-safe curated knowledge retrieval, role-aware workspace scoping,
  CSRF protection, short-window rate limiting, daily quotas, and prompt-safe
  observability.
