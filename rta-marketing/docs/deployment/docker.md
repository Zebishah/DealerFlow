# Docker deployment

The repository includes reproducible images for every active service:

| Service | Image base | Dockerfile |
| --- | --- | --- |
| Dealership API | Node 22 | `apps/dealership-api/Dockerfile` |
| Dealership web | Node 22 build + Nginx | `apps/dealership-web/Dockerfile` |
| Scraping API | Node 22 | `apps/scraping-api/Dockerfile` |
| Scraping web | Node 22 build + Nginx | `apps/scraping-web/Dockerfile` |
| Scraping worker | Node 22 + Playwright-managed Chromium | `apps/scraping-worker/Dockerfile` |

All builds use the root `package-lock.json`. The dealership web and scraping
web use the same Vite major version, preventing duplicate Vite type errors on
clean installations.

## Run the complete local portfolio stack

Create the two local environment files first. Use real values locally; never
commit them:

```bash
cd rta-marketing
cp .env.example .env
cp apps/dealership-api/.env.example apps/dealership-api/.env
```

Set `DATABASE_URL`, the Redis password, scrape credentials, dealership session
secrets, and other required values in those files. Then run:

```bash
docker compose -f docker-compose.portfolio.yml config --quiet
docker compose -f docker-compose.portfolio.yml up -d --build
docker compose -f docker-compose.portfolio.yml ps
```

Open:

```text
Dealership dashboard: http://localhost:8080
Scraping dashboard:   http://localhost:8081
```

Redis is internal to the Compose network and has no published host port.

## Live dealership dashboard deployment

Docker support does not replace the current production services:

```text
dealership-web  → Vercel → dealership-api on Render → Apify Actor → Neon

## Preserved legacy scraping deployment
scraping-web    → Vercel
scraping-api    → Render
scraping-worker → Azure
Redis           → Northflank
PostgreSQL      → Neon
```

Vercel and Render should continue using their workspace build commands and
environment variables from the platform deployment guides.
