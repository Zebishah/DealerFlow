# AI opportunities audit

This audit reviewed the monorepo applications, database schema, auth/session
boundaries, dealership routes, scraping stack, deployment files, and existing
tests. The main opportunity is an assistant that explains the product and
retrieves authorized operational facts; a vector database is not required for
the first release.

| Priority | Opportunity | Evidence in the repository | Recommended approach | Status |
|---|---|---|---|---|
| P0 | Site-wide product and operations assistant | Multiple role-aware pages and stable API modules already exist | Shared UI, curated knowledge, deterministic read-only tools, optional provider | Implemented |
| P0 | Product navigation and contextual help | Navigation routes and page modules are explicit | Send an allowlisted route context; return allowlisted navigation actions | Implemented |
| P0 | Recruiter/demo assistant | Seeded demo workspace and recruiter access already exist | Public product answers; sanitized recruiter-visible workspace facts only | Implemented |
| P0 | Deterministic analytics explanations | Leads, sales, targets, and acquisition metrics are stored in PostgreSQL | Calculate in SQL/service code; use the model only to explain | Implemented |
| P1 | Lead qualification and next-action suggestions | Lead status, assignment, and timestamps are present | Bounded deterministic next actions; never auto-update leads or send contact data | Implemented |
| P1 | Inventory recommendations and comparisons | Canonical vehicles, active listings, prices, mileage, and source URLs exist | Search persisted listings only with explainable matching and comparison | Implemented |
| P1 | Market-price explanations | Active comparable listings contain normalized prices | Compare same make/model/year inventory; do not present it as an external appraisal | Implemented |
| P1 | Scraping intelligence | Sources, source runs, scrape runs, failures, and normalized items exist | Explain actual health/run data; do not trigger jobs automatically | Status implemented |
| P1 | Sales and commission explanations | Sales and commission fields plus targets are available | Keep all arithmetic deterministic and role-scoped | Performance insights implemented |
| P2 | Document intelligence | Employee documents are private S3 objects | Add only after explicit document retrieval/redaction policy and audit trail | Deferred |
| P2 | Anomaly detection and forecasting | Historical data exists but no evaluation/training pipeline is defined | Establish labeled metrics and offline evaluation before production claims | Deferred |

## Delivery plan

1. Ship the current assistant foundation with provider disabled by default and
   validate the public/demo experience.
2. Enable an approved low-cost provider on the API only, with a small quota,
   timeout, and sampled redacted observability.
3. Add lead summaries, vehicle comparison explanations, and sales next-action
   drafts as read-only features with role-specific test fixtures.
4. Add document retrieval or anomaly/forecasting only after their data
   governance, evaluation, and retention requirements are explicit.

The current implementation intentionally does not add embeddings, arbitrary
URL browsing, raw SQL tools, shell tools, email sending, automatic scraping, or
write-capable AI actions. Those would expand risk without being necessary for
the highest-value first release.
