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

The worker is manual-only by default. A presenter may enqueue one source with:

```bash
cd rta-marketing
npm run scrape:once -- --site=pakwheels --limit=5
```

The production limits and security behavior are documented in the scraping
deployment guide and covered by `tests/portfolio-policy.test.ts`.
