# Database performance audit

No production or external database was contacted during this audit, and no
benchmark numbers are fabricated here. The repository does not currently
include a safe, seeded PostgreSQL dataset large enough to make local
`EXPLAIN ANALYZE` results representative.

## Query paths reviewed

- authenticated scraped-inventory filters and pagination;
- public live-source inventory filters;
- catalog listing filters and cursor pagination;
- dashboard lead/sales aggregates;
- source and Apify-run status reads;
- lead search and saved-vehicle lookups.

The schema already has targeted indexes for common workspace/status/timestamp,
source identity, saved-vehicle ownership, and Apify run status/order paths. No
new index was added without measured evidence. The current inventory projection
uses the retained `scraped_items` table, whose schema is owned by the legacy
scraping subsystem; changing it requires a separate migration review.

## Repeatable audit procedure

Against a disposable local PostgreSQL database with a deterministic fixture
dataset, capture each query's SQL and run:

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) <query>;
```

Record planning/execution time, rows removed, scan type, buffers, and selected
indexes before proposing a migration. The result must be attached to a future
change before adding or removing an index.
