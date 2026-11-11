# Dealer Flow

**AI-powered dealership operations and vehicle intelligence.**

Dealer Flow is a role-aware dealership operations platform with leads, sales, targets,
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

**[Open the DealerFlow live demo](https://dealer-flow-kappa.vercel.app/)** · [Architecture](rta-marketing/docs/architecture/current-production.md)

The recruiter demo described in the [portfolio brief](rta-marketing/docs/PORTFOLIO.md) uses sanitized data and role-limited access.

## Why this project matters

Dealer Flow brings together dealership operations, vehicle intelligence, asynchronous
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

## Product walkthrough

Use the [live demo](https://dealer-flow-kappa.vercel.app/) to explore the overview dashboard, vehicle intelligence, analytics, and source-health workspace. Screenshots are not included until recruiter-safe captures have been verified; see the [capture guidelines](rta-marketing/docs/screenshots/README.md).

## Testing / quality

The repository includes TypeScript checks, Vitest unit/integration coverage,
Playwright business smoke flows, axe accessibility checks, linting, builds,
database migrations, Docker definitions, and GitHub Actions CI. See the
[portfolio brief](rta-marketing/docs/PORTFOLIO.md) for the quality boundary.

## Repository layout

| Path | Purpose |
|---|---|
| `rta-marketing/apps/dealership-web/` | React dealership workspace and public inventory |
| `rta-marketing/apps/dealership-api/` | Express API, authentication, domain data, and Apify acquisition |
| `rta-marketing/apps/scraping-actor/` | On-demand vehicle acquisition Actor |
| `rta-marketing/apps/scraping-*` | Retained scraping applications and worker alternatives |
| `rta-marketing/packages/` | Shared database, source adapters, contracts, and assistant UI |
| `rta-marketing/docs/` | Architecture, operations, deployment, and portfolio evidence |

## Local setup

Use Node.js 22+, npm, and PostgreSQL. Start from the repository root:

```bash
git clone https://github.com/Zebishah/DealerFlow.git
cd DealerFlow/rta-marketing
npm ci
cp apps/dealership-api/.env.example apps/dealership-api/.env
cp apps/dealership-web/.env.example apps/dealership-web/.env
docker compose up -d
```

Configure the API's database connection, independent session/CSRF secrets, allowed browser origin, and frontend URL. The Compose database uses the local credentials in `docker-compose.yml`; hosted Neon uses separate pooled and migration URLs. Follow the [environment guide](rta-marketing/docs/deployment/environment.md). Apify credentials are required for on-demand acquisition; Redis, document storage, email, and AI need their own configuration when enabled.

```bash
# From DealerFlow/rta-marketing/
npm run db:migrate --workspace=@rta/dealership-api
npm run dev:dealership-api
```

In another terminal:

```bash
# From DealerFlow/rta-marketing/
npm run dev:dealership-web
```

The API example uses port 5000 and the web application uses port 5173. Seed only a disposable demonstration database using the documented seed configuration. See [Docker deployment](rta-marketing/docs/deployment/docker.md) for the full optional stack.

## Development checks

```bash
# From DealerFlow/rta-marketing/
npm run typecheck
npm run lint
npm test
npm run build
```

Tests that require PostgreSQL, external providers, or browser execution need their corresponding test configuration. Provider and live-scraping validation are distinct from local unit checks.

## Branding compatibility

The product name is **Dealer Flow** across the interface, email, assistant, and documentation. Existing `rta-marketing/` paths, `@rta/*` workspace packages, database identifiers, and deployment addresses remain compatible with the existing infrastructure. Set `EMAIL_FROM_NAME=Dealer Flow` in deployments that already override the email sender name.
