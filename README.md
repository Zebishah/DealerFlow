# RTA Automotive Operations & Vehicle Intelligence

RTA is a role-aware dealership operations platform with leads, sales, targets,
commissions, documents, audit history, analytics, grounded AI assistance, and
approved vehicle intelligence.

The current production path is deliberately small:

`Vercel dealership web → Render dealership API → Neon PostgreSQL`

On-demand scraping runs through `Apify Actor → approved source adapters → Neon`.
Upstash Redis provides distributed limits, AI quotas, and short-lived caches; it
is not the current scraper queue. Older BullMQ/Azure and AWS SQS/Lambda paths
remain documented reference implementations.

Start with the [project guide](rta-marketing/README.md), then see the
[current production architecture](rta-marketing/docs/architecture/current-production.md),
[portfolio brief](rta-marketing/docs/PORTFOLIO.md), and
[deployment guide](rta-marketing/docs/deployment/platform.md).

## Live demo

- Public landing page: `LIVE_DEMO_URL_TODO` (set the confirmed deployed URL
  before sharing externally)
- Recruiter access: use the seeded demo flow described in
  [`docs/PORTFOLIO.md`](rta-marketing/docs/PORTFOLIO.md); it uses sanitized data
  and role-limited access.

## Why this project matters

RTA brings together dealership operations, vehicle intelligence, asynchronous
source acquisition, grounded AI assistance, reliability/resilience,
observability, and secure recruiter/demo access in one inspectable product.

## Current stack

React · TypeScript · Vite · Node.js/Express · PostgreSQL/Neon · Redis/Upstash ·
Apify Actors · AWS S3 · AI assistant · Recharts · Vitest · Playwright · axe
accessibility testing · Docker · GitHub Actions CI

## Recruiter view in 60 seconds

Open the landing page, browse the public inventory, enter the recruiter demo,
inspect Analytics and Vehicle intelligence, then open Scraping workspace to see
source health and safe System Health telemetry. The architecture docs explain
which integrations are live and which remain reference-only.

## Screenshots

Capture these final deployed states manually: Overview dashboard, Vehicle
intelligence, Analytics, and Operations/source health. The capture checklist is
in [`docs/screenshots/README.md`](rta-marketing/docs/screenshots/README.md).

## Testing / quality

The repository includes TypeScript checks, Vitest unit/integration coverage,
Playwright business smoke flows, axe accessibility checks, linting, builds,
database migrations, Docker definitions, and GitHub Actions CI. See the
[portfolio brief](rta-marketing/docs/PORTFOLIO.md) for the quality boundary.
