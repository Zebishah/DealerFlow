# Apify scraping runtime

The Apify Actor is an additional execution target for approved public vehicle
sources. It does not replace the existing BullMQ/Redis queue, scraping API,
scraping worker, Azure VM deployment, GitHub worker CI, retry/backoff,
distributed locking, stale-job recovery, or observability paths.

## Source audit

The audit was performed before adding an adapter. A source was approved only
when its public listing path was accessible without authentication or bypassing
anti-bot controls, its robots policy allowed the required path, and its terms
did not explicitly prohibit the intended extraction.

| Source | Technical result | Policy result |
| --- | --- | --- |
| [JamesEdition cars](https://www.jamesedition.com/cars) | Public, server-rendered cars page. `robots.txt` was blocked by Cloudflare during the audit and could not be verified safely. | Rejected for this release because robots permission is unverified. |
| [LuxuryPulse](https://luxurypulse.com/) | Public listings and pagination are visible. | Rejected: [terms](https://luxurypulse.com/terms) prohibit copying, extraction, and database reuse without permission. |
| [Classics on Autotrader](https://classics.autotrader.com/) | Public SSR listings and pagination are visible, but direct crawler access returned Akamai HTTP 403. | Rejected: implementing it would depend on an anti-bot/WAF bypass, which is out of scope. |
| [Classic Driver](https://www.classicdriver.com/) | Not audited for implementation. | Explicitly excluded by project requirements. |
| [CollectorCarList](https://www.collectorcarlist.com/) | Public SSR listings, robots allows the public path, and no explicit automated-crawling prohibition was found in the terms audit. The non-www URL redirects to this canonical host. | **Approved replacement.** Uses Cheerio and a bounded one-page strategy. |

The target of three approved sources could not be met without implementing a
source that failed the policy or anti-bot checks. CollectorCarList is the
verified replacement implemented in this phase; rejected sources remain
documented rather than silently treated as approved.

## Two supported architectures

### Existing queue runtime

The existing production path remains:

`scraping-api -> BullMQ/Redis -> scraping-worker -> @rta/scrapers -> @rta/db`

It continues to own manual triggers, queue retries, distributed scrape locks,
stale-job recovery, status updates, and the existing PakWheels/OLX adapters.

### Apify runtime

The Actor path is:

`Apify Actor input -> approved @rta/scrapers adapter -> @rta/db`

The Actor validates `{ siteKey, limit }`, verifies the database, invokes the
shared adapter, persists normalized items, writes `OUTPUT`, and exits. It has
no BullMQ or Redis dependency and cannot select rejected or legacy sources.

The `limit` is a maximum, not a minimum. For example, `Requested: 5, Found: 3,
Status: completed` is successful. A normally loaded page with zero valid
listings is also successful; navigation, source-blocking, crawler, and database
failures remain failures.

## Actor configuration

Required environment variables:

- `DATABASE_URL`
- `SCRAPER_SITES_JSON` containing the approved `collector-car-list` site config
- `SCRAPER_USER_AGENT`

Optional shared scraper settings include `SCRAPE_DEFAULT_LIMIT`,
`SCRAPE_MAX_LIMIT`, `SCRAPE_NAVIGATION_TIMEOUT_MS`,
`SCRAPE_SELECTOR_TIMEOUT_MS`, `SCRAPE_JOB_TIMEOUT_MS`, and
`CRAWLEE_MEMORY_MBYTES`.

The recommended Apify container profile is 4096 MB with Crawlee memory capped
around 3000 MB, concurrency 1, a 60-second scrape-job bound, and a 120-second
container-level budget. These are operational defaults, not billing or plan
assumptions. The current source uses Cheerio, so the Actor Docker image does
not install a Playwright browser.

The current Actor environment value is:

```text
SCRAPER_SITES_JSON='[{"key":"collector-car-list","name":"CollectorCarList","baseUrl":"https://www.collectorcarlist.com/","engine":"cheerio","itemSelector":"a[href^=\"/listings/\"]","titleSelector":"h3","priceSelector":"div > p","linkSelector":"a[href^=\"/listings/\"]","delayMs":2500,"maxConcurrency":1}]'
```

Keep the Actor private in Apify metadata and do not place database URLs,
Redis credentials, scraper tokens, cookies, or request headers in logs or
Actor output.

## Parser behavior and limitations

The CollectorCarList adapter uses one public page and stops at the requested
maximum. It normalizes the existing `ScrapedItem` shape, deduplicates stable
listing URLs, resolves relative links and image URLs, handles lazy/srcset
images, preserves raw source fields, and keeps “Price on request” as source
text. The live card contract is an anchor whose path begins with
`/listings/`, with an `h3` title, labelled `Asking`, `Miles`, and `Location`
value blocks, and a lazy-loaded image using `srcset`/Next image attributes. It
skips malformed cards rather than manufacturing title, URL, mileage, image,
or price values. A page with the explicit `0 cars available` and `No listings
found` state is a valid empty inventory; an otherwise normal page with no
listing contract raises a source-contract error.

The source currently exposes a bounded public page rather than a verified
pagination contract. Pagination should be audited separately before adding
additional page requests.

## Build and Docker context

Build locally with `npm run build:scraping-actor` and typecheck with
`npm run typecheck:scraping-actor`. Build `apps/scraping-actor/Dockerfile`
from the repository root so workspace manifests and packages are available.
The Dockerfile compiles shared, database, scrapers, and Actor workspaces and
does not modify the existing scraping API or worker Dockerfiles.
