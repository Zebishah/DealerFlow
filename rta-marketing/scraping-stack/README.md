# RTA scraping stack

This is the portfolio scraping implementation for RTA. It keeps the existing
AWS SQS/Lambda implementation in the parent application untouched and adds a
manual BullMQ pipeline for the vehicle-intelligence workspace.

## Production architecture

```text
Vercel frontend ──HTTPS──> Render scraping API ──BullMQ──> Northflank Redis (TLS)
       │                            │                              │
       │                            │                              ▼
       └──── reads listings ◄──── Neon PostgreSQL       Azure Linux VM worker
                                                               │
                                             Cheerio + Playwright + Chromium
```

- Vercel hosts `apps/frontend` only.
- Render hosts `apps/api`, which validates requests and queues BullMQ jobs.
- Northflank hosts the authenticated TLS Redis addon. Redis is not exposed by
  this repository or by the worker VM.
- Azure hosts one always-on worker container. The worker includes Chromium, so
  Cheerio and Playwright run on the same VM. There is no Cloud Run browser
  service and no second Northflank worker in the final design.
- The target Azure VM is Standard_B1s on Ubuntu Server 24.04 LTS x64 Gen2,
  with one vCPU, 1 GiB RAM, and approximately 2 GiB Linux swap for temporary
  Chromium memory spikes.
- Neon PostgreSQL is the durable source of truth for sites and listings.
- The worker has no public HTTP port. It consumes `vehicle-scrape` jobs only.

The current repository has a Playwright adapter, not a Puppeteer adapter. The
Azure image installs the system Chromium binary used by Playwright. Puppeteer
should only be added if a future scraper actually needs it.

BullMQ remains the execution boundary: three attempts, exponential backoff,
bounded completed/failed-job cleanup, concurrency one, and graceful shutdown.
The worker does not schedule automatic crawls. A scrape starts only when an
operator clicks `Scrape now` or runs the manual CLI command.

### Portfolio-safe limits

The default production profile is intentionally small:

- manual-only scraping (`MANUAL_SCRAPING_ONLY=true`);
- exactly one BullMQ worker and one active scrape at a time;
- 10 vehicles by default and never more than 20 per run;
- one Chromium instance, one page at a time, with images/media/fonts blocked;
- 30-second navigation, 15-second selector, and 120-second overall job limits;
- active-job locking and deterministic job IDs prevent repeated dashboard clicks;
- Chromium is created per browser job and torn down before the worker becomes
  idle again.

The dashboard lets a presenter request a smaller limit. The API clamps every
request server-side, so a client cannot start an unbounded crawl.

## Repository map

```text
apps/api/       Express API and BullMQ producer
apps/worker/    BullMQ consumer, Cheerio/Playwright execution, Neon writes
apps/frontend/  Vite dashboard
packages/db/    Drizzle schema, migrations, and listing persistence
packages/shared Config, Redis TLS factory, and Zod contracts
packages/scrapers Crawlee Cheerio/Playwright adapters
deploy/         Render, Northflank, Azure, and Vercel deployment guide
```

## Local setup

Requirements: Docker Compose and Node.js 20+.

```bash
cp .env.example .env
# Edit DATABASE_URL, REDIS_PASSWORD, CORS_ORIGIN, and SCRAPER_SITES_JSON.
docker compose up -d --build
docker compose ps
docker compose logs --no-color --tail=100 worker
```

Local Compose starts Redis, the API, and the Chromium-capable worker on a
private Docker network. The API is bound to `127.0.0.1:4000`; it is not
published publicly by Compose.

Run the frontend separately:

```bash
cd apps/frontend
npm install
VITE_API_URL=http://localhost:4000 npm run dev
```

The dashboard queues a site-specific job. The worker performs the crawl and
writes normalized listings to Neon. A 15-second per-source cooldown prevents
accidental duplicate clicks.

## Manual scraping

The worker stays idle until a job is queued. Use a specific source key when
testing so the synthetic source is not run accidentally:

```bash
npm run scrape:once -- --site=pakwheels
npm run scrape:once -- --site=olx-pakistan
npm run scrape:once -- --site=pakwheels --limit=5
```

With Docker Compose:

```bash
docker compose exec worker node apps/worker/dist/enqueue-once.js --site=pakwheels
docker compose exec worker node apps/worker/dist/enqueue-once.js --site=olx-pakistan
docker compose logs -f worker
```

After `site scrape completed`, inspect the API-backed results:

```bash
curl http://localhost:4000/api/sites
```

## Source configuration

The checked-in example contains two configured sources and one clearly labeled
synthetic source:

| Source | Engine | Concurrency |
| --- | --- | ---: |
| PakWheels | CheerioCrawler | 1 |
| OLX Pakistan | PlaywrightCrawler | 1 |
| Demo Source (synthetic data) | deterministic generator | 1 |

The exact JSON belongs in `SCRAPER_SITES_JSON` and is available in
`.env.example`. Keep the configured user agent truthful, respect each source's
robots and terms, and do not add stealth tooling or rotating proxies.

## Environment ownership

Render API:

```text
NODE_ENV=production
DATABASE_URL=<Neon pooled URL>
REDIS_URL=<exact Northflank TLS connection URL>
API_PORT=10000
CORS_ORIGIN=<Vercel production URL>
SCRAPER_USER_AGENT=<truthful contact URL>
SCRAPER_SITES_JSON=<exact JSON from .env.example>
SCRAPE_DEFAULT_LIMIT=10
SCRAPE_MAX_LIMIT=20
WORKER_CONCURRENCY=1
MANUAL_SCRAPING_ONLY=true
```

Azure worker:

```text
NODE_ENV=production
DATABASE_URL=<same Neon pooled URL>
REDIS_URL=<same Northflank TLS connection URL>
SCRAPER_USER_AGENT=<truthful contact URL>
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
SCRAPER_SITES_JSON=<exact JSON from .env.example>
SCRAPE_DEFAULT_LIMIT=10
SCRAPE_MAX_LIMIT=20
WORKER_CONCURRENCY=1
MANUAL_SCRAPING_ONLY=true
```

Do not put `REDIS_HOST=localhost` in either hosted service. Do not copy Redis
credentials into the frontend. Do not commit `.env` files.

## Verification

```bash
npm install
npm run build
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl http://localhost:4000/health
```

The worker should log `scraping worker started` with `database: connected` and
`redis: connected`. The Azure worker guide includes Redis, Neon, Chromium, and
end-to-end checks.

## Deployment

See [deploy/DEPLOY.md](deploy/DEPLOY.md) for the final staged deployment:

1. Create/check the Northflank Redis addon.
2. Deploy the API to Render.
3. Create the Azure VM only with a free-service-eligible size and disk.
4. Build and run the Chromium-capable worker with Docker.
5. Deploy the frontend to Vercel and set its API URL.
6. Configure budgets, alerts, rollback tags, and manual smoke tests.

The parent RTA AWS/SQS/Lambda deployment is deliberately outside this guide.
