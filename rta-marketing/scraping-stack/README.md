# RTA scheduled scraping stack

This is a separate portfolio implementation of the vehicle-scraping pipeline. It preserves the original RTA AWS/SQS/Lambda code under the parent application while providing a Docker-only alternative using BullMQ and self-hosted Redis.

## Architecture

```text
React/Vite on Vercel ── HTTPS ──► Nginx on Oracle VM
                                      │
                                      ▼
                              Scraping API container
                                      │
                              private Docker network
                                      ▼
                              Redis ◄── BullMQ ── Worker
                                      │              │
                                      └──── Neon ◄────┘
                                                     │
                                             Crawlee scrapers
                                             Cheerio / Playwright
```

The API is separate from scraping. API requests remain fast while the worker executes scheduled jobs, applies retries/backoff, respects robots.txt, and persists each site’s results. The API never waits for a third-party page to load.

BullMQ with self-hosted Redis makes queue behavior visible and portable on the Oracle VM, with a named Redis volume for persistence. The scraping API and worker share a private Docker network with Redis; Redis has no host-published port. The existing RTA project also demonstrates AWS SQS/Lambda as a separate cloud-worker design; this stack does not delete or replace that implementation.

Neon PostgreSQL and Drizzle provide foreign-key integrity, JSONB fallback data, and committed migrations. Docker runs Redis, the scraping API, and the worker on Oracle. The API and worker both use the same Neon `DATABASE_URL`.

## Repository map

```text
apps/api/       Express API reference and dependency health endpoint
apps/worker/    BullMQ scheduler and worker process
apps/frontend/  Vite demonstration UI, deployed separately
packages/db/    Drizzle schema and migrations
packages/shared Config, site definitions, and Zod contracts
packages/scrapers Crawlee Cheerio/Playwright adapters
deploy/         Oracle VM deployment guide
```

## Local setup

Requirements: Docker Compose and Node.js 20+ for frontend development.

```bash
cp .env.example .env
# Edit credentials and SCRAPER_SITES_JSON when URLs are available.
docker compose up -d --build
docker compose ps
docker compose logs --no-color --tail=100 worker
```

The Compose stack has Redis, the scraping API, and the worker. Set the Neon connection string, a strong `REDIS_PASSWORD`, and the Vercel `CORS_ORIGIN` in `.env`; the API and worker connect to Redis as `redis:6379` on the private Docker network.

Run the frontend separately:

```bash
cd apps/frontend
npm install
VITE_API_URL=http://localhost:4000 npm run dev
```

The dashboard shows a `Scrape now` button on every configured source. Clicking it sends a `POST` request to the API, which queues a site-specific BullMQ job; the worker then performs the real crawl and writes the results to Neon. Open the frontend at the Vite URL, click a PakWheels or OLX card's button, wait for the success message, then open the card to view the saved listings. The API applies a 15-second per-source cooldown to prevent accidental duplicate clicks.

The worker registers one BullMQ scheduler with the cron value in `SCRAPE_CRON` (default: every six hours). Jobs use three attempts with exponential backoff and bounded Redis cleanup. All configured sources run with `Promise.allSettled`, so one failure is logged without preventing the other sources from being attempted. API startup runs the Drizzle migration before opening port 4000, and both API and worker emit structured Pino logs.

### Run one real source immediately

The CLI enqueues a normal BullMQ job and the existing worker performs the scrape and Neon upserts. Pass a specific source key to avoid running the synthetic source:

```bash
npm run scrape:once -- --site=pakwheels
npm run scrape:once -- --site=olx-pakistan
```

When the stack is running only in Docker, use the same CLI inside the worker container:

```bash
docker compose exec worker node apps/worker/dist/enqueue-once.js --site=pakwheels
docker compose exec worker node apps/worker/dist/enqueue-once.js --site=olx-pakistan
docker compose logs -f worker
```

The command does not generate demo data when a site is specified. After the worker reports `site scrape completed`, inspect Neon-backed results through `curl http://localhost:4000/api/sites` and the site detail endpoint returned by that response.

## Site configuration

The current configuration contains two permitted live sources and one clearly labeled synthetic source. Gari.pk is excluded because its terms prohibit automated page scraping. Hamariweb’s classifieds subdomain could not be resolved from the verification environment, so it remains unconfigured rather than being treated as authorized. The exact JSON is in `.env.example`:

| Source | Engine | Crawl target | Delay | Concurrency |
| --- | --- | --- | ---: | ---: |
| PakWheels | CheerioCrawler | `/used-cars/search/-/` | 2.5s | 2 |
| OLX Pakistan | PlaywrightCrawler | canonical `/cars_c84` | 4.5s | 1 |
| Demo Source (synthetic data) | deterministic generator | local generator | 0s | 1 |

The PakWheels adapter uses the verified `li.classified-listing`, `.search-title a.car-name.ad-detail-path`, `.price-details`, `.ad-specs`, `.search-vehicle-info`, and `.img-box img` structure. The OLX adapter waits for `article` cards and reads the verified `aria-label="Title"`, `Price`, `Year`, `Mileage`, `Location`, `Cover Photo`, and `/item/` link structure. It performs two bounded scroll passes and never constructs filtered/query URLs.

To add another permitted source later, put one JSON object in `SCRAPER_SITES_JSON`:

```json
[
  {
    "key": "site-one",
    "name": "Site One",
    "baseUrl": "https://example.com/inventory",
    "engine": "playwright",
    "itemSelector": "article",
    "titleSelector": "h2",
    "priceSelector": ".price",
    "linkSelector": "a"
  }
]
```

Use `cheerio` for server-rendered HTML and `playwright` for JavaScript-rendered inventory. The scraper sends a configured user agent, checks robots.txt, applies the per-site delay/concurrency settings, and does not use stealth or rotating proxies. The synthetic demo source is deliberately labeled and uses deterministic seeded generation so the architecture can be demonstrated without treating an unverified website as an authorized source.

## Verification

```bash
npm install
npm run build
docker compose config
docker compose up -d --build
docker compose ps
curl http://localhost:4000/api/sites
```

The worker image installs Debian's ARM64-compatible `chromium` package and points Playwright at `/usr/bin/chromium`. The Docker base image is `node:20-bookworm-slim`, which publishes ARM64 variants. Neon supplies PostgreSQL, so no database container or local database volume is required.

## Oracle Cloud note

The target is the Oracle Cloud Always Free Ampere A1 VM. This project assumes a 2 OCPU/12 GB allocation. It is suitable for a portfolio demonstration but has no production capacity guarantee. A production deployment should use a paid VPS or managed services with backups, monitoring, and predictable resources. See [deploy/DEPLOY.md](deploy/DEPLOY.md).
