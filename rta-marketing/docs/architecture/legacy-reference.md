# Legacy/reference architecture

The repository intentionally retains the earlier queue-worker systems for
portfolio and engineering-reference purposes. They are not the active
dealership dashboard scraping path.

```text
scraping-web -> scraping-api -> BullMQ -> private Redis -> scraping-worker -> Neon
                                      \
                                       AWS SQS/Lambda reference path
```

This architecture demonstrates bounded browser acquisition, queue retries,
distributed locks, outbox delivery, SQS partial-batch handling, Lambda
reconciliation, and Azure/Chromium deployment. It retains the old source
adapters and related schemas so the migration history remains inspectable.

The legacy worker now has two explicit safety gates:

1. `ENABLE_LEGACY_WORKER=true` is required before it starts or writes.
2. In `NODE_ENV=production`, `ALLOW_LEGACY_PRODUCTION_WRITES=true` is also
   required.

The defaults are disabled. A disabled worker logs a warning and exits without
opening its queue or database writer. `enqueue-once` also refuses to queue a
job until the first gate is enabled. Never point this reference worker at the
production Neon database unless the second opt-in is intentional and reviewed.

The legacy API, worker, Redis queue, Docker Compose files, Azure scripts, and
AWS/SQS/Lambda code remain in place. They are documented separately so they
cannot be mistaken for the current Apify deployment.
