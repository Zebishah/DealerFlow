# Scraping subsystem architecture

```text
scraping-web (Vercel)
        │ HTTPS
        ▼
scraping-api (Render)
        │ BullMQ
        ▼
Northflank Redis ───────► scraping-worker (Azure)
                                │
                         Cheerio + Playwright
                                │
                                ▼
                         Neon PostgreSQL
```

The scraping subsystem is intentionally separate from the dealership API.
The API validates one permitted source, applies authentication, rate limits,
the active-job lock, and the five/ten vehicle limits before enqueueing a
BullMQ job. The worker runs with one concurrency slot, one browser/page at a
time, and closes Chromium after each job.

`apps/scraping-web` is a Vite interface. Read-only listing/status requests use
the configured `VITE_API_URL`; authenticated scrape actions use the Vercel
same-origin function and a short-lived HttpOnly session. No scrape token is
bundled into browser JavaScript.

`apps/scraping-api` connects to Northflank Redis over its TLS URL and to Neon.
`apps/scraping-worker` consumes the `vehicle-scrape` queue and writes
normalized listings to the scraping tables in Neon. It has no public HTTP
port.

Each manual job reports queue state, attempt/max-attempt, stage, elapsed time,
requested count, found count, and bounded timings for robots, configured delay,
browser launch, navigation, selector wait, extraction, persistence, and total
duration. The status endpoint exposes this data without exposing credentials.

The source limit is a maximum target. Once the bounded source strategy has
been inspected, the worker persists every valid listing found, including zero
or fewer results than requested, and marks the job completed. Only genuine
technical failures enter the two-attempt retry boundary.

The worker is manual-only by default. A presenter may enqueue one source with:

```bash
cd rta-marketing
npm run scrape:once -- --site=pakwheels --limit=5
```

The Playwright path is bounded to one task and one open page/browser at a time.
On the Azure B1s VM, set `CRAWLEE_MEMORY_MBYTES=450`; this leaves headroom for
Node, Chromium, the OS, and database/Redis connections. The setting is
configurable but capped at 450 MB by the shared worker configuration.

The production limits and security behavior are documented in the scraping
deployment guide and covered by `tests/portfolio-policy.test.ts`.
