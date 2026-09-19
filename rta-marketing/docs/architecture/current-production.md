# Current production architecture

The active dealership product is a modular React/Vite frontend and Express API:

```text
dealership-web (Vercel)
        |
dealership-api (Render)
   |         |       \
 Neon    Upstash      Apify Actor (on demand)
 durable  limits/       |
 data     cache       approved source adapters
```

The API owns authentication, authorization, dealership workflows, Apify run
metadata, and safe read projections. Neon PostgreSQL is authoritative. The
Apify Actor is the only writer for the current scraped inventory and does not
receive Redis or BullMQ credentials.

Upstash Redis is deliberately ephemeral. It stores distributed rate-limit
counters, UTC-day AI quota counters, and short-lived cache-aside entries. A
cache failure falls back to PostgreSQL; a configured rate-limit/quota failure
fails closed with a safe 503. Redis is not a scraper queue in this topology.

Gemini, Groq, and OpenRouter are optional AI providers behind the API's bounded
fallback chain and circuit suppression. Brevo handles transactional email when
configured. S3 is used for document storage when configured. None of these
providers receives browser credentials.

Operational endpoints are protected by existing session/RBAC middleware:

- `GET /api/v1/operations/health`
- `GET /api/v1/operations/metrics-summary`
- `GET /api/v1/operations/source-health`
- `POST /api/v1/operations/reconcile-apify`

Reconciliation is manual or externally schedulable; no always-on maintenance
worker is started by the application.
