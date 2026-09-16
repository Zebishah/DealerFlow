# Apify scraping runtime

The Apify Actor is the live execution target for the dealership dashboard's
approved public vehicle sources. The existing BullMQ/Redis queue, scraping API,
scraping worker, Azure VM deployment, GitHub worker CI, retry/backoff,
distributed locking, stale-job recovery, and observability paths remain in the
repository as reference architecture.

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
| [Romans International](https://www.romansinternational.com/used/cars/) | Public server-rendered vehicle cards with verified pagination. | **Approved production source.** Uses Cheerio and sequential pagination. |
| [Tom Hartley](https://www.tomhartley.com/used/) | Server-rendered used inventory cards expose vehicle-detail URLs and detail pages. | **Approved production source.** Uses Cheerio, strict inventory-card discovery, and bounded detail crawling. |
| [Redline Specialist Cars](https://redlinespecialistcars.co.uk/) | The public `/cars/` shell exposes category links; confirmed category pages are server-rendered with vehicle cards. Its sitemap is a bounded Rank Math index. | **Approved production source.** Uses `/cars/` category-link discovery with relevant page-sitemap fallback. |
| [CollectorCarList](https://www.collectorcarlist.com/) | Existing adapter and fixture tests are retained. | **Legacy/internal only.** Not available in the live Actor source set. |

The live Actor source set is intentionally limited to the three approved
production sources above. PakWheels, OLX, and CollectorCarList remain in the
repository for internal and legacy use; rejected sources remain documented
rather than silently treated as approved.

## Two supported architectures

### Existing queue runtime

The existing production path remains:

`scraping-api -> BullMQ/Redis -> scraping-worker -> @rta/scrapers -> @rta/db`

It continues to own manual triggers, queue retries, distributed scrape locks,
stale-job recovery, status updates, and the existing PakWheels/OLX adapters.

### Current dealership dashboard runtime

The live dealership flow is:

`dealership-web -> dealership-api -> Apify Actor -> approved sources -> Neon`

The API stores only Apify run metadata. The Actor remains the sole writer of
scraped vehicle records, preventing duplicate persistence.

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
- `SCRAPER_SITES_JSON` containing the three approved luxury source configs
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
SCRAPER_SITES_JSON='[{"key":"romans-international","name":"Romans International","baseUrl":"https://www.romansinternational.com/used/cars/","engine":"cheerio","strategy":"cards","itemSelector":".vehicle--teaser[data-vehicle]","titleSelector":".vehicle__title","priceSelector":".vehicle__price","linkSelector":"a[href*=\"/used/cars/\"]","delayMs":2250,"maxConcurrency":1},{"key":"tom-hartley","name":"Tom Hartley","baseUrl":"https://www.tomhartley.com/used/","engine":"cheerio","strategy":"cards","itemSelector":".used-list-vehicle-wrap","titleSelector":".used-list-summary__heading","priceSelector":".used-list-vehicle__price","linkSelector":"a[href*=\"/used-car-details/\"]","delayMs":2250,"maxConcurrency":1},{"key":"redline-specialist-cars","name":"Redline Specialist Cars","baseUrl":"https://redlinespecialistcars.co.uk/cars/","engine":"cheerio","strategy":"cards","sitemapUrl":"https://redlinespecialistcars.co.uk/sitemap.xml","categoryPathPattern":"^/[a-z0-9][a-z0-9-]*-cars-for-sale/$","itemSelector":".col-md-4[data-at-price][data-at-year][data-at-mileage]","titleSelector":".product-content h4","priceSelector":".price","linkSelector":".item-link","delayMs":2250,"maxConcurrency":1}]'
```

Keep the Actor private in Apify metadata and do not place database URLs,
Redis credentials, scraper tokens, cookies, or request headers in logs or
Actor output.

## Parser behavior and limitations

The live Actor uses Romans International cards, Tom Hartley inventory-card-filtered
vehicle detail pages, and Redline Specialist Cars public `/cars/` category-link
discovery with relevant page-sitemap fallback. Each adapter uses Cheerio, one request at a time, bounded discovery,
stable URL deduplication, source-native text, lazy/srcset or background-image
handling, robots checks, and explicit source-contract diagnostics. A valid
empty inventory completes with zero items; malformed markup, interstitials,
HTTP failures, and blocked paths remain technical failures. CollectorCarList,
PakWheels, and OLX adapters remain available internally but are not live Actor
choices.

Romans follows its public page-number pagination until the requested maximum;
Tom Hartley and Redline use bounded discovery queues and stop scheduling new
detail/category pages as soon as the requested maximum is reached.

## Build and Docker context

Build locally with `npm run build:scraping-actor` and typecheck with
`npm run typecheck:scraping-actor`. Build `apps/scraping-actor/Dockerfile`
from the repository root so workspace manifests and packages are available.
The Dockerfile compiles shared, database, scrapers, and Actor workspaces and
does not modify the existing scraping API or worker Dockerfiles.
