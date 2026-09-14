# Scraping deployment

The scraping production path is:

```text
scraping-web (Vercel) → scraping-api (Render) → Northflank Redis
                                                     ↓
                                          scraping-worker (Azure)
                                                     ↓
                                                Neon PostgreSQL
```

## Local Compose verification

From the monorepo directory:

```bash
cd rta-marketing
cp .env.example .env
nano .env
docker compose -f docker-compose.scraping.yml config --quiet
docker compose -f docker-compose.scraping.yml up -d --build
docker compose -f docker-compose.scraping.yml ps
```

The Compose Redis service has no published host port. The API and worker use
the internal service name `redis:6379`. The worker includes Chromium and is
the only process that executes Cheerio/Playwright jobs.

## Neon and Northflank

Use the pooled Neon connection string as `DATABASE_URL`. Use the exact TLS
connection URL supplied by the Northflank Redis addon as `REDIS_URL`.

Do not expose Redis publicly and do not put its password in browser variables.
The API and worker must use the same Redis database and queue configuration.

## Render: scraping-api

Configure a Render web service with:

```text
Root Directory: rta-marketing
Build Command: npm ci --include=dev && npm run build:scraping-api
Start Command: node apps/scraping-api/dist/index.js
```

Set these Render environment variables:

```text
NODE_ENV=production
DATABASE_URL=<Neon pooled connection string>
REDIS_URL=<Northflank rediss:// connection URL>
API_PORT=10000
CORS_ORIGIN=https://<scraping-web-domain>
SCRAPE_TRIGGER_TOKEN=<32+ character random secret>
SCRAPE_ACCESS_CODE=<16+ character recruiter access code>
SCRAPER_SITES_JSON=<valid configured source JSON>
CRAWLEE_MEMORY_MBYTES=450
SCRAPE_DEFAULT_LIMIT=5
SCRAPE_MAX_LIMIT=10
WORKER_CONCURRENCY=1
MANUAL_SCRAPING_ONLY=true
SCRAPE_NAVIGATION_TIMEOUT_MS=20000
SCRAPE_SELECTOR_TIMEOUT_MS=8000
SCRAPE_JOB_TIMEOUT_MS=60000
SCRAPE_LOCK_TTL_SECONDS=180
```

The retry budget is deliberately small: BullMQ allows two worker attempts with
a 5-second exponential backoff, and each Crawlee source request allows one
request retry. The lock TTL must cover both worker attempts, the backoff, and a
handoff margin. These limits keep a manual run bounded and prevent nested
retries from multiplying production latency.

Run `npm run db:migrate:scraping` from a trusted release environment when
applying scraping schema migrations. Do not expose the trigger token to the
browser.

## Vercel: scraping-web

Configure the Vercel project with:

```text
Root Directory: rta-marketing
Build Command: npm run build --workspace=@rta/scraping-web
Output Directory: apps/scraping-web/dist
Framework Preset: Vite
```

Set:

```text
VITE_API_URL=https://<render-scraping-api-domain>
SCRAPE_API_URL=https://<render-scraping-api-domain>
```

`VITE_API_URL` is browser-visible and contains no credential. `SCRAPE_API_URL`
is used only by the Vercel server function and must not be prefixed with
`VITE_`. The access code is entered by the presenter and exchanged for a
short-lived HttpOnly session.

The Vercel project root is `rta-marketing`; the root `api/[...path].ts` file
is the deployment adapter for the authenticated scrape-session and scrape
trigger routes. The application itself remains in `apps/scraping-web`.

## Azure: scraping-worker

The Azure VM keeps its runtime environment at:

```text
~/rta-worker/.env
```

That file must contain the Neon URL, Northflank `REDIS_URL`, scraper user
agent, source JSON, existing limits, and `CRAWLEE_MEMORY_MBYTES=450`. Do not
commit, replace, or copy it into the image.

The worker image is:

```text
ghcr.io/zebishah/rta-worker:latest
ghcr.io/zebishah/rta-worker:<commit-sha>
```

The Dockerfile is `apps/scraping-worker/Dockerfile`. The image uses Node 22 and
installs the Chromium revision managed by the installed Playwright package with
its required Debian dependencies. The worker always uses that managed
executable and runs `node apps/scraping-worker/dist/index.js` with one worker
slot; it has no public HTTP port.

CI/CD is defined in [`worker-ci.yml`](../../../.github/workflows/worker-ci.yml).
Pull requests validate only. Pushes and manual runs on
`portfolio-hardening` build, publish, SSH to Azure, deploy the immutable SHA
image, verify health/startup logs, and roll back automatically if validation
fails.

Required GitHub secrets:

```text
AZURE_VM_HOST
AZURE_VM_USER
AZURE_VM_SSH_KEY
AZURE_VM_KNOWN_HOSTS
GHCR_USERNAME
GHCR_READ_TOKEN   # read:packages only
```

The VM must be logged into GHCR and the Azure user must be allowed to run
Docker. The deployment script preserves the previous image and the existing
`.env`, enforces the `rta-worker` container name, checks Redis/database startup
logs, and removes unused image layers after a successful release.

## Manual worker verification

```bash
cd rta-marketing
npm run typecheck:scraping
npm run build:scraping-worker
docker build -f apps/scraping-worker/Dockerfile -t rta-worker:local .
docker compose -f docker-compose.scraping.yml config --quiet
```

The normal workflow remains manual-only. A scrape starts only when an
authorized operator clicks a source button or invokes the bounded CLI.

The requested vehicle count is a maximum, not a minimum. A normally loaded
source that exposes three valid listings for a request of five completes
successfully with `Requested: 5` and `Found: 3`; it is not retried merely to
reach five. Navigation, timeout, blocking, browser, Redis, and database errors
remain retryable technical failures.
