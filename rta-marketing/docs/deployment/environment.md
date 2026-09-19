# Environment contract

Copy the committed examples and replace placeholders locally or in the hosting provider. Do not commit real values.

## Local files

| File | Process | Contains secrets? |
|---|---|---:|
| `apps/dealership-api/.env` | Express API | Yes |
| `apps/dealership-api/.env.worker.local` | Local SQS worker | Yes |
| `apps/dealership-web/.env` | Browser UI | No |

Create them with:

```bash
cp apps/dealership-api/.env.example apps/dealership-api/.env
cp apps/dealership-api/.env.worker.example apps/dealership-api/.env.worker.local
cp apps/dealership-web/.env.example apps/dealership-web/.env
```

The API and worker use the same Neon database. The SQS values below belong to
the retained reference path and are only needed when that path is explicitly
enabled. Use Neon’s pooled URL for `DATABASE_URL`; use its direct/non-pooled URL
only for `DATABASE_MIGRATION_URL` and migrations.

## Required attributes

### Primary RTA API (Render; Apify scraping path)

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` / `PORT` | `0.0.0.0` / provider-managed application port |
| `LOG_LEVEL` | `info` |
| `TRUST_PROXY` | `true` |
| `PUBLIC_APP_URL` | Exact Vercel frontend URL |
| `CORS_ORIGINS` | Exact frontend URL, comma-separated if more than one |
| `DATABASE_URL` | Neon pooled connection URL |
| `REDIS_URL` | Upstash Redis TLS URL (`rediss://...`); shared by Render API instances |
| `AWS_REGION` | Required config value, e.g. `ap-south-1`; SQS stays disabled in the live path |
| `SQS_INTEGRATION_ENABLED` | `false`; set `true` only for an intentional AWS reference-path deployment |
| `SESSION_SECRET` / `CSRF_SECRET` | Two independent 48+ character secrets |
| `SESSION_COOKIE_SECURE` | `true` |
| `SESSION_COOKIE_SAME_SITE` | `none` when frontend/API use different origins |
| `DEMO_MODE` | `true` |
| `DEFAULT_SCRAPE_MODE` | `fixture` |
| `ALLOW_LIVE_SCRAPING` | `false` until live adapters are verified |

`REDIS_URL` is server-only. The live Apify routes do not use the legacy SQS
queue or scraping-stack API URL/token. `ALLOW_LIVE_SCRAPING` and
`DEFAULT_SCRAPE_MODE` govern the retained `/scrape-runs` reference path; they do
not disable `/scraping-results/:siteId/trigger`, the Apify route.

Do not add `AWS_PROFILE` to a deployed service. Remove `SEED_OPERATOR_PASSWORD` after running the explicit seed command.

### Lambda worker

| Variable | Production value |
|---|---|
| `NODE_ENV` / `LOG_LEVEL` | `production` / `info` |
| `DATABASE_URL` | Neon pooled URL; pool max should be `2` |
| `AWS_REGION` | Same region as SQS |
| `LIVE_SCRAPING_ENABLED` | Start with `false` |
| `BROWSER_HEADLESS` | `true` |
| `SCRAPE_JOB_TIMEOUT_MS` | Less than Lambda timeout, e.g. `540000` |
| `BROWSER_NAVIGATION_TIMEOUT_MS` | `60000` |
| `SOURCE_MIN_DELAY_MS` | `1500` or more |
| `SCRAPE_MAX_PAGES_PER_SOURCE` | `20` |
| `SCRAPE_MAX_LISTINGS_PER_SOURCE` | `500` |

Do not add permanent AWS access keys to Lambda. Its execution role supplies temporary credentials automatically. The SAM event mappings default to disabled; enable them only for an intentional showcase deployment.

### Browser frontend (Vercel)

| Variable | Production value |
|---|---|
| `VITE_API_URL` | The HTTPS URL of the API used by that frontend, including `/api/v1` where applicable |

Only public browser configuration may use the `VITE_` prefix. Never expose database, AWS, cookie, or session values through Vite.

The separate scraping monitor additionally uses `VITE_DEALERSHIP_API_URL` for
its public-only assistant connection. Configure the dealership API
`CORS_ORIGINS` to include both deployed browser origins.

### Site-wide assistant

The assistant is disabled safely by default. It can answer curated product
questions without a provider key; authenticated operational answers use the
allowlisted, read-only database tools. The key and provider URL belong only to
the dealership API environment, never to either browser app.

| Variable | Production guidance |
|---|---|
| `AI_ENABLED` | `true` only after the provider and quotas are configured |
| `AI_PROVIDER` | `gemini` (recommended), `groq`, `openrouter`, or `none` |
| `AI_FALLBACK_PROVIDERS` | Optional comma-separated failover order, for example `groq,openrouter` |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` | Server-only provider keys; no OpenAI billing is required |
| `AI_MODEL` | Optional model override for the selected primary provider |
| `GEMINI_MODEL` | Defaults to the currently documented free-tier `gemini-2.5-flash-lite` |
| `GROQ_MODEL` | Defaults to the current Groq replacement `openai/gpt-oss-20b` |
| `OPENROUTER_MODEL` | Defaults to `openrouter/free`; availability and limits vary |
| `AI_BASE_URL` / `AI_API_KEY` | Only for an explicitly selected custom OpenAI-compatible provider |
| `AI_PUBLIC_CHAT_ENABLED` | `true` for the public product assistant; `false` to require sign-in |
| `AI_MAX_INPUT_CHARS` / `AI_MAX_MESSAGES` | Keep the request context bounded, for example `2000` / `8` |
| `AI_MAX_OUTPUT_TOKENS` | Keep responses concise, for example `700` |
| `AI_REQUEST_TIMEOUT_MS` | Keep provider calls bounded, for example `12000` |
| `AI_RATE_LIMIT_WINDOW_MS` / `AI_RATE_LIMIT_MAX` | Per-user/IP protection, for example `60000` / `12` |
| `AI_DAILY_QUOTA` | Per-user/IP daily cap, for example `200` |

The API always validates tool arguments and response envelopes. Provider
failure falls back to deterministic product knowledge or an authorized tool;
it does not grant broader data access. Public users receive product knowledge
only. Free providers are opt-in, and Gemini is the default recommended
provider; OpenRouter remains optional because its free models have lower daily
limits. Migrations continue to use `DATABASE_MIGRATION_URL`; assistant traffic
uses the pooled `DATABASE_URL`.

For a no-billing Gemini setup, sign in to [Google AI Studio](https://aistudio.google.com/), open the API keys page, choose **Create API key**, and copy the key into Render as `GEMINI_API_KEY`. Do not click **Set up billing**. Google documents that new AI Studio keys are created as authorization keys and recommends restricting keys to the Gemini API. The Gemini free tier may use requests to improve Google products, so the assistant intentionally keeps public chat product-only and removes lead notes/contact fields before authorized tool results reach a model.

Recommended Render variables:

```dotenv
AI_ENABLED=true
AI_PROVIDER=gemini
AI_FALLBACK_PROVIDERS=groq,openrouter
GEMINI_API_KEY=your_google_ai_studio_key
AI_MODEL=gemini-2.5-flash-lite
AI_PUBLIC_CHAT_ENABLED=true
AI_MAX_INPUT_CHARS=2000
AI_MAX_MESSAGES=8
AI_MAX_OUTPUT_TOKENS=700
AI_REQUEST_TIMEOUT_MS=12000
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=12
AI_DAILY_QUOTA=200
```

### Live Apify dealership scraping

The dealership API uses these server-only variables for the live dashboard
trigger and status flow. Never add the token to `VITE_*` variables.

```dotenv
APIFY_API_TOKEN=your_apify_api_token
APIFY_ACTOR_ID=your_apify_actor_id
APIFY_API_BASE_URL=https://api.apify.com/v2
APIFY_RUN_TIMEOUT_SECONDS=120
APIFY_DEFAULT_SCRAPE_LIMIT=5
APIFY_MAX_SCRAPE_LIMIT=10
```

Set the same Upstash `REDIS_URL` on the Render dealership API. It is used for
cross-instance rate limiting, UTC-day AI quota counters, and expiring API
caches—not scraping jobs. Keep the Upstash database private and use its TLS
`rediss://` connection string.

The Vercel dealership web app needs only its browser-safe API URL:

```dotenv
VITE_API_URL=https://<dealership-api-domain>/api/v1
```

The Apify Actor needs `DATABASE_URL`, `SCRAPER_SITES_JSON`, and the existing
scraper timeout, memory, user-agent, and limit variables documented in
`docs/architecture/apify-scraping.md`. The old `SCRAPING_STACK_API_URL` and
`SCRAPING_STACK_API_TOKEN` variables remain only for the legacy scraping stack.

`GROQ_API_KEY` and `OPENROUTER_API_KEY` are optional. If supplied, they are
used only as failover providers; set `GROQ_MODEL` to an active Groq model and
leave `OPENROUTER_MODEL=openrouter/free` for OpenRouter's free router.

For Groq as the primary free provider, create a Groq API key in the Groq
console and add these exact Render environment variables to the dealership API
service:

```dotenv
AI_ENABLED=true
AI_PROVIDER=groq
AI_FALLBACK_PROVIDERS=openrouter
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-20b
OPENROUTER_API_KEY=optional_openrouter_key
OPENROUTER_MODEL=openrouter/free
AI_PUBLIC_CHAT_ENABLED=true
AI_MAX_INPUT_CHARS=2000
AI_MAX_MESSAGES=8
AI_MAX_OUTPUT_TOKENS=700
AI_REQUEST_TIMEOUT_MS=12000
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=12
AI_DAILY_QUOTA=200
```

Use `AI_PROVIDER=groq`, not `openai-compatible`: `openai-compatible` is
reserved for a custom endpoint configured with `AI_BASE_URL` and `AI_API_KEY`.
No `OPENAI_API_KEY`, OpenAI billing, or frontend `VITE_*` provider key is
required. If you want the full priority chain, use
`AI_PROVIDER=gemini`, `AI_FALLBACK_PROVIDERS=groq,openrouter`, and supply the
corresponding server-side keys; each fallback is skipped when its key is not
configured.

### Scraping stack (Oracle Docker Compose)

The scraping API and BullMQ worker run on the same Oracle VM as Redis. Redis is
internal to the Compose network and is never published to the host or the
internet.

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Neon pooled connection URL |
| `REDIS_HOST` / `REDIS_PORT` | `redis` / `6379` |
| `REDIS_PASSWORD` | Long random value shared only by the Compose services |
| `CORS_ORIGIN` | Exact Vercel production URL |
| `API_PORT` | `4000` |
| `CRAWLEE_MEMORY_MBYTES` | `450` on the Azure B1s worker; explicit Crawlee autoscaling memory budget |

The API is bound to `127.0.0.1:4000` on the VM so host Nginx can proxy HTTPS
traffic to it. Do not add a Redis port mapping.

## Why fixture mode is the default

`ALLOW_LIVE_SCRAPING=false` blocks public API requests from starting real website automation. `LIVE_SCRAPING_ENABLED=false` is an independent worker-side kill switch. Fixture mode still runs validation, normalization, deduplication, persistence, and dashboard flow using deterministic input. With the portfolio defaults, SQS outbox rows remain inspectable and no AWS call is made. This protects free quotas and third-party sites while development is ongoing.

## Controlled local live test

Live scraping is supported locally with Puppeteer's managed Chrome; Firefox and Helium are not supported by the current adapters. Install Chrome without installing a system-wide Chromium package:

```bash
cd apps/dealership-api
npx puppeteer browsers install chrome
```

Use these API overrides in `apps/dealership-api/.env`:

```dotenv
NODE_ENV=development
PUBLIC_APP_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
ALLOW_LIVE_SCRAPING=true
DEFAULT_SCRAPE_MODE=fixture
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAME_SITE=lax
```

Use these worker overrides in `apps/dealership-api/.env.worker.local`:

```dotenv
NODE_ENV=development
LIVE_SCRAPING_ENABLED=true
BROWSER_HEADLESS=true
BROWSER_DISABLE_SANDBOX=false
BROWSER_EXECUTABLE_PATH=
WORKER_CONCURRENCY=1
SCRAPE_MAX_PAGES_PER_SOURCE=2
SCRAPE_MAX_LISTINGS_PER_SOURCE=50
SCRAPE_SCREENSHOT_ON_ERROR=true
SCRAPE_ARTIFACT_DIR=/tmp/rta-scraper
```

Keep `DEFAULT_SCRAPE_MODE=fixture`: it controls the UI/default behavior, not whether live testing is possible. The two explicit live switches are a defense-in-depth safety control.

The deployed Lambda and local worker must not consume the same queue simultaneously. Temporarily disable its event source mapping before starting the local worker:

```bash
RTA_MAPPING_UUID=$(aws lambda list-event-source-mappings \
  --function-name rta-scrape-worker \
  --region ap-south-1 \
  --profile rta-deploy \
  --query 'EventSourceMappings[0].UUID' \
  --output text)
aws lambda update-event-source-mapping --uuid "$RTA_MAPPING_UUID" --no-enabled \
  --region ap-south-1 --profile rta-deploy
```

Enable live sources and ensure an operator exists:

```bash
SEED_LIVE_SOURCES=true npm run db:seed
```

Start three terminals:

```bash
# terminal 1
cd apps/dealership-api && npm run dev

# terminal 2
cd apps/dealership-api && npm run worker:dev

# terminal 3
  cd apps/dealership-web && npm run dev
```

Open `http://localhost:5173`, choose **Live mode**, sign in as the seeded operator, and begin with one narrow make/model query. Inspect the Operations screen, worker logs, database results, and `/tmp/rta-scraper` if an adapter fails.

After testing, stop the local worker and re-enable Lambda:

```bash
aws lambda update-event-source-mapping --uuid "$RTA_MAPPING_UUID" --enabled \
  --region ap-south-1 --profile rta-deploy
```

## Secrets

Generate two independent secrets:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Rotate any credentials ever pasted into chat or committed to Git history before deployment. A `.gitignore` entry only prevents future commits; it does not remove old secrets from history.
