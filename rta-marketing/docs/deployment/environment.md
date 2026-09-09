# Environment contract

Copy the committed examples and replace placeholders locally or in the hosting provider. Do not commit real values.

## Local files

| File | Process | Contains secrets? |
|---|---|---:|
| `backend/.env` | Express API | Yes |
| `backend/.env.worker.local` | Local SQS worker | Yes |
| `frontend/.env` | Browser UI | No |

Create them with:

```bash
cp backend/.env.example backend/.env
cp backend/.env.worker.example backend/.env.worker.local
cp frontend/.env.example frontend/.env
```

The API and worker use the same Neon database and SQS queue. Use Neon’s pooled URL for `DATABASE_URL`; use its direct/non-pooled URL only for `DATABASE_MIGRATION_URL` and migrations.

## Required attributes

### Primary RTA API (AWS/SQS deployment)

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` / `PORT` | `0.0.0.0` / provider-managed application port |
| `LOG_LEVEL` | `info` |
| `TRUST_PROXY` | `true` |
| `PUBLIC_APP_URL` | Exact Vercel frontend URL |
| `CORS_ORIGINS` | Exact frontend URL, comma-separated if more than one |
| `DATABASE_URL` | Neon pooled connection URL |
| `AWS_REGION` | Queue region, e.g. `ap-south-1` |
| `SQS_SCRAPE_QUEUE_URL` | Main queue URL, not the DLQ URL |
| `QUEUE_OUTBOX_POLL_MS` / `QUEUE_OUTBOX_BATCH_SIZE` | `5000` / `10` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Dedicated API producer IAM user keys |
| `SESSION_SECRET` / `CSRF_SECRET` | Two independent 48+ character secrets |
| `SESSION_COOKIE_SECURE` | `true` |
| `SESSION_COOKIE_SAME_SITE` | `none` when frontend/API use different origins |
| `DEMO_MODE` | `true` |
| `DEFAULT_SCRAPE_MODE` | `fixture` |
| `ALLOW_LIVE_SCRAPING` | `false` until live adapters are verified |

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

Do not add permanent AWS access keys to Lambda. Its execution role supplies temporary credentials automatically. SQS queue URL is not required by the Lambda handler because the event-source mapping supplies messages.

### Browser frontend (Vercel)

| Variable | Production value |
|---|---|
| `VITE_API_URL` | The HTTPS URL of the API used by that frontend, including `/api/v1` where applicable |

Only public browser configuration may use the `VITE_` prefix. Never expose database, AWS, cookie, or session values through Vite.

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

The API is bound to `127.0.0.1:4000` on the VM so host Nginx can proxy HTTPS
traffic to it. Do not add a Redis port mapping.

## Why fixture mode is the default

`ALLOW_LIVE_SCRAPING=false` blocks public API requests from starting real website automation. `LIVE_SCRAPING_ENABLED=false` is an independent worker-side kill switch. Fixture mode still runs the real SQS, validation, normalization, deduplication, persistence, and dashboard flow, but uses deterministic input. This protects free quotas and third-party sites while development is ongoing.

## Controlled local live test

Live scraping is supported locally with Puppeteer's managed Chrome; Firefox and Helium are not supported by the current adapters. Install Chrome without installing a system-wide Chromium package:

```bash
cd backend
npx puppeteer browsers install chrome
```

Use these API overrides in `backend/.env`:

```dotenv
NODE_ENV=development
PUBLIC_APP_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
ALLOW_LIVE_SCRAPING=true
DEFAULT_SCRAPE_MODE=fixture
SESSION_COOKIE_SECURE=false
SESSION_COOKIE_SAME_SITE=lax
```

Use these worker overrides in `backend/.env.worker.local`:

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
cd backend && npm run dev

# terminal 2
cd backend && npm run worker:dev

# terminal 3
  cd frontend && npm run dev
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
