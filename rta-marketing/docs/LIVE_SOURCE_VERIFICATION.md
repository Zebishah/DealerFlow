# Live source verification

Verification date: 2026-09-05

Use one source per run with:

```dotenv
WORKER_CONCURRENCY=1
SCRAPE_MAX_PAGES_PER_SOURCE=1
SCRAPE_MAX_LISTINGS_PER_SOURCE=10
SOURCE_MIN_DELAY_MS=1800
```

Keep the Lambda SQS event-source mapping disabled while a local worker consumes
the same queue. Re-enable it when local verification finishes.

| Source | URL checked | Navigation | Parsed/valid/rejected | Status |
| --- | --- | --- | --- | --- |
| AutoTrader | `https://www.autotrader.ca/a/volkswagen/jetta/toronto/ontario/5_66931898_on20080219110434703/` | Redirected to the current `/offers/...` listing and rendered vehicle details plus Product/Car JSON-LD | Not run through the local worker | Reachable; search-card selector verification still required |
| AutoPlanet | `https://www.autoplanet.ca/vehicles/2024/volkswagen/taos/brampton/on/71155495/print/` | Cloudflare hard access denial | 0/0/0 | Blocked in the verification browser; no bypass attempted |
| Humberview | `https://humberviewvw.com/en` | Browser client returned `ERR_BLOCKED_BY_CLIENT` | 0/0/0 | Not verified |
| Yorkdale VW | supplied inventory URL | Cloudflare hard access denial | 0/0/0 | Blocked in the verification browser; no bypass attempted |

Do not label a source verified until a controlled worker run records its final
URL, navigation response, selector count, parsed count, valid count, rejection
count, duration, and final status.
