# RTA Automotive Operations Platform

RTA is a portfolio-grade dealership operations platform with a separate,
manual vehicle-scraping subsystem. The boundaries are intentional: the
dealership platform retains an isolated AWS SQS/Lambda reference implementation
for portfolio showcase, while scraping runs through BullMQ, Redis, and a
dedicated browser-capable worker.

## Applications

| Application | Responsibility | Production hosting |
|---|---|---|
| `apps/dealership-web` | Main dealership dashboard for leads, sales, documents, targets, commissions, team, audit, and vehicle intelligence | Vercel or static hosting |
| `apps/dealership-api` | Main authenticated RTA API, PostgreSQL domain, S3 documents, and SQS/Lambda ingestion | AWS |
| `apps/scraping-web` | Manual scraping dashboard and persisted vehicle search | Vercel |
| `apps/scraping-api` | Authenticated BullMQ job producer and scraping API | Render |
| `apps/scraping-worker` | Cheerio/Playwright worker with Chromium | Azure VM |

## Shared packages

- `packages/db` — scraping listing schema, Neon persistence, and migrations.
- `packages/shared` — scraping configuration, contracts, Redis connection, and security helpers.
- `packages/scrapers` — bounded Cheerio/Playwright source adapters.

The dealership API keeps its own domain schema and AWS ingestion implementation
because it has a different deployment and data responsibility.

## Production architecture

```mermaid
flowchart LR
  DW[dealership-web] --> DA[dealership-api]
  DA --> AWS[AWS SQS + Lambda reference path\n(disabled by default)]
  DA --> N[Neon PostgreSQL]
  SW[scraping-web] --> SA[scraping-api]
  SA --> R[Northflank Redis]
  R --> WK[scraping-worker on Azure]
  WK --> N
  SA --> N
```

## Local development

Requirements: Node.js 22 for the dealership apps, Node.js 20+ for the
scraping apps, and npm.

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

## Deployment documentation

- [Architecture](docs/architecture/overview.md)
- [Scraping architecture](docs/architecture/scraping.md)
- [Deployment](docs/deployment/platform.md)
- [Scraping deployment](docs/deployment/scraping.md)
- [Environment setup](docs/deployment/environment.md)
- [Operations](docs/operations/)
- [Azure worker CI/CD](../.github/workflows/worker-ci.yml)

Never commit `.env` files, cloud credentials, database URLs, Redis passwords,
or access tokens. The root workspace `.gitignore` and repository-level ignore
rules cover application secrets, build output, dependency folders, and local
scraper artifacts.
