# RTA — AI-Powered Automotive Dealership Operations & Vehicle Intelligence

RTA is a dealership operations platform with on-demand vehicle intelligence.
The live dashboard runs approved vehicle scrapes through ephemeral Apify Actor
runs and persists results into Neon. Upstash Redis is an ephemeral API layer for
distributed request limits, AI quotas, and short-lived read caches; it is not a
job queue or worker backend. The previous BullMQ/Redis/Azure implementation
remains as a separate legacy reference architecture.

The product includes a site-wide, read-only RTA Assistant. It combines curated
product knowledge with role- and workspace-authorized tools for natural-language
analytics, lead next actions, vehicle recommendations, listing comparisons,
market-price explanations, sales-performance insights, and scraping
troubleshooting. Deterministic calculations remain server-side; the assistant
cannot execute SQL, browse arbitrary URLs, run commands, mutate business data,
or start scraping jobs. Public/demo conversations use sanitized context.

## Applications

| Application | Responsibility | Production hosting |
|---|---|---|
| `apps/dealership-web` | Main dealership dashboard for leads, sales, documents, targets, commissions, team, audit, and vehicle intelligence | Vercel or static hosting |
| `apps/dealership-api` | Main authenticated RTA API, PostgreSQL domain, S3 documents, and Apify dashboard integration | Render |
| `apps/scraping-web` | Legacy/reference scraping dashboard and persisted vehicle search | Vercel (legacy) |
| `apps/scraping-api` | Legacy BullMQ job producer and scraping API | Render (legacy) |
| `apps/scraping-worker` | Legacy Cheerio/Playwright queue consumer | Azure VM (not part of current Apify flow) |

## Shared packages

- `packages/db` — scraping listing schema, Neon persistence, and migrations.
- `packages/shared` — scraping configuration, contracts, Redis connection, and security helpers.
- `packages/scrapers` — bounded Cheerio/Playwright source adapters.

The dealership API keeps its own domain schema. Its AWS ingestion code is a
retained reference integration; the live acquisition flow uses Apify and Neon.

## Live production architecture

The live flow is `dealership-web → dealership-api → Apify Actor → approved
international sources → Neon → dashboard refresh`. Upstash Redis sits beside
the API for distributed limits/quotas and short-lived caches. The dealership
API starts an on-demand Apify run and persists run metadata; the Actor remains
the sole writer of scraped vehicle records. This flow needs no permanent
scraper worker or Redis-backed job queue.

## Legacy/reference architecture

```mermaid
flowchart LR
  DW[dealership-web] --> DA[dealership-api]
  DA <--> UR[Upstash Redis\nrate limits · AI quotas · cache]
  DA --> AWS[AWS SQS + Lambda reference path\n(disabled by default)]
  DA --> N[Neon PostgreSQL]
  SW[scraping-web] --> SA[scraping-api]
  SA --> R[Legacy Redis/BullMQ]
  R --> WK[scraping-worker on Azure]
  WK --> N
  SA --> N
```

## Local development

Requirement: Node.js 22+ and npm for the complete workspace. The scraping
packages remain compatible with Node.js 20+ when developed independently.

```bash
cd rta-marketing
npm ci
npm run typecheck
npm run build
npm test
```

Run an application with the named root scripts:

```bash
npm run dev:dealership-web
npm run dev:dealership-api
npm run dev:scraping-web
npm run dev:scraping-api
npm run dev:scraping-worker
```

The main local database Compose file is `docker-compose.yml`. The scraping
stack uses `docker-compose.scraping.yml`; its Redis service is private and the
worker includes Chromium.

For a complete local run of all services, use
[`docker-compose.portfolio.yml`](docker-compose.portfolio.yml). See the
[Docker deployment guide](docs/deployment/docker.md) for setup details.

## Deployment documentation

- [Architecture](docs/architecture/overview.md)
- [Scraping architecture](docs/architecture/scraping.md)
- [Deployment](docs/deployment/platform.md)
- [Scraping deployment](docs/deployment/scraping.md)
- [Docker deployment](docs/deployment/docker.md)
- [Environment setup](docs/deployment/environment.md)
- [Operations](docs/operations/)
- [Portfolio brief](docs/PORTFOLIO.md)
- [Portfolio freeze and scope](docs/PORTFOLIO_FREEZE.md)
- [AI assistant architecture](docs/architecture/ai-assistant.md)
- [AI live verification plan](docs/operations/ai-live-verification.md)
- [Azure worker CI/CD](../.github/workflows/worker-ci.yml)

Never commit `.env` files, cloud credentials, database URLs, Redis passwords,
or access tokens. The root workspace `.gitignore` and repository-level ignore
rules cover application secrets, build output, dependency folders, and local
scraper artifacts.

## Product presentation

The landing page presents RTA as an AI-powered operating system for dealership
teams rather than as a generic chatbot. The public assistant is intentionally
product-focused; authenticated users receive only the read-only tools permitted
by their role and workspace. Provider configuration, free-tier setup, and
server-only key handling are documented in
[`docs/deployment/environment.md`](docs/deployment/environment.md).
