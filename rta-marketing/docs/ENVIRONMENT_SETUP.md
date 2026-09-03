# Environment contract

Copy the committed examples and replace placeholders locally or in the hosting provider. Do not commit real values.

## Local files

| File | Process | Contains secrets? |
|---|---|---:|
| `backend/.env` | Express API | Yes |
| `backend/.env.worker.local` | Local SQS worker | Yes |
| `rta-scrapper/.env` | Browser UI | No |

Create them with:

```bash
cp backend/.env.example backend/.env
cp backend/.env.worker.example backend/.env.worker.local
cp rta-scrapper/.env.example rta-scrapper/.env
```

The API and worker use the same Neon database and SQS queue. Use Neon’s pooled URL for `DATABASE_URL`; use its direct/non-pooled URL only for `DATABASE_MIGRATION_URL` and migrations.

## Required attributes

### API on Render

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` / `PORT` | `0.0.0.0` / Render-provided `PORT` |
| `LOG_LEVEL` | `info` |
| `TRUST_PROXY` | `true` |
| `PUBLIC_APP_URL` | Exact Render frontend URL |
| `CORS_ORIGINS` | Exact frontend URL, comma-separated if more than one |
| `DATABASE_URL` | Neon pooled connection URL |
| `AWS_REGION` | Queue region, e.g. `ap-south-1` |
| `SQS_SCRAPE_QUEUE_URL` | Main queue URL, not the DLQ URL |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Dedicated API producer IAM user keys |
| `SESSION_SECRET` / `CSRF_SECRET` | Two independent 48+ character secrets |
| `SESSION_COOKIE_SECURE` | `true` |
| `SESSION_COOKIE_SAME_SITE` | `none` when frontend/API are on different Render sites |
| `DEMO_MODE` | `true` |
| `DEFAULT_SCRAPE_MODE` | `fixture` |
| `ALLOW_LIVE_SCRAPING` | `false` until live adapters are verified |

Do not add `AWS_PROFILE` on Render. Remove `SEED_OPERATOR_PASSWORD` after running the explicit seed command.

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
| `SOURCE_MAX_CONCURRENT_PAGES` | `1` |
| `SOURCE_MIN_DELAY_MS` | `1500` or more |
| `SCRAPE_MAX_PAGES_PER_SOURCE` | `20` |
| `SCRAPE_MAX_LISTINGS_PER_SOURCE` | `500` |

Do not add permanent AWS access keys to Lambda. Its execution role supplies temporary credentials automatically. SQS queue URL is not required by the Lambda handler because the event-source mapping supplies messages.

### Render static frontend

| Variable | Production value |
|---|---|
| `VITE_API_URL` | `https://YOUR-API.onrender.com/api/v1` |

Only public browser configuration may use the `VITE_` prefix. Never expose database, AWS, cookie, or session values through Vite.

## Why fixture mode is the default

`ALLOW_LIVE_SCRAPING=false` blocks public API requests from starting real website automation. `LIVE_SCRAPING_ENABLED=false` is an independent worker-side kill switch. Fixture mode still runs the real SQS, validation, normalization, deduplication, persistence, and dashboard flow, but uses deterministic input. This protects free quotas and third-party sites while development is ongoing.

## Secrets

Generate two independent secrets:

```bash
openssl rand -base64 48
openssl rand -base64 48
```

Rotate any credentials ever pasted into chat or committed to Git history before deployment. A `.gitignore` entry only prevents future commits; it does not remove old secrets from history.
