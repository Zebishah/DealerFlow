# Portfolio freeze

This branch is frozen around a focused, explainable production story:

`Vercel → Render → Neon`, with `Apify` on-demand and `Redis` as an API-side
support service.

The freeze does not add Kafka, RabbitMQ, a second scraper queue, a permanent
worker, or autonomous scraping. It keeps the existing BullMQ/Azure and
AWS/SQS/Lambda code only as reference-compatible architecture with explicit
safety gates.

The required quality bar is: strict validation, role and workspace boundaries,
safe logging, bounded retries/timeouts, operational telemetry, source-health
visibility, responsive loading/error/empty states, dependency audit review,
unit/integration tests, Playwright smoke/accessibility coverage, typechecking,
builds, lint, and clean diffs.

Synthetic data is used only for demo-safe seeded surfaces. No real customer
data, credentials, database URLs, API tokens, or provider secrets belong in
the repository or public UI.
