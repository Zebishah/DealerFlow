# RTA Environment Setup

This is the infrastructure contract for the portfolio edition. It replaces the original company Firebase project and keeps development provider-neutral.

## What the owner needs to provide

### Required for hosted development/production

1. **PostgreSQL database**
   - Recommended: create a personal Neon project.
   - Create a dedicated database/role for RTA rather than reusing another application's credentials.
   - Provide both the pooled application URL (`DATABASE_URL`) and direct migration URL (`DATABASE_MIGRATION_URL`).
   - Do not paste either URL into chat or commit it. Put them in the hosting provider's secret settings and local `.env` files.

2. **Redis-compatible service**
   - Use a personal Upstash Redis, Redis Cloud, or self-hosted Redis instance that exposes a Redis protocol URL.
   - Save its `redis://` or TLS `rediss://` URL as `REDIS_URL` for both API and worker.
   - Use a dedicated RTA database/instance where practical.

3. **Operator login values**
   - Choose a demo/operator email and a unique strong initial password.
   - These values are read only by an explicit seed command; the password will be hashed before database storage.
   - Remove the seed password from deployed environment settings after the account is created.

4. **Application secrets**
   - Generate independent session and CSRF secrets locally:

     ```bash
     openssl rand -base64 48
     openssl rand -base64 48
     ```

   - Store them as `SESSION_SECRET` and `CSRF_SECRET`.

5. **Final application URLs**
   - After hosting is chosen, provide the public web URL and API URL.
   - The web URL becomes `PUBLIC_APP_URL` and an entry in `CORS_ORIGINS`.
   - The API URL becomes the browser-safe `VITE_API_BASE_URL`.

### Not required

- **Firebase:** not used in the focused portfolio architecture. Authentication, saved vehicles, listings, and run state move to PostgreSQL/backend APIs.
- **Email provider:** not required initially because public signup and password reset are not part of the recruiter demo. It can be added later if those features become real requirements.
- **S3 or Firebase Storage:** not required initially. The app stores source image URLs and sanitized local fixture assets; diagnostic artifacts remain private and short-lived.
- **LLM/API keys:** RTA's engineering story is scraping, normalization, identity, reliability, and search. AI is intentionally not required.
- **Payment provider:** not relevant.

## Local development without cloud accounts

PostgreSQL and Redis will be provided through Docker Compose. Copy the examples without committing the resulting files:

```bash
cp backend/.env.example backend/.env
cp backend/.env.worker.example backend/.env.worker
cp rta-scrapper/.env.example rta-scrapper/.env
```

Local development should keep `DEMO_MODE=true`, `ALLOW_LIVE_SCRAPING=false`, and `SCRAPE_MODE=fixture` until database migrations, tests, and deterministic fixture ingestion are green.

## Environment ownership

| Variable group | API | Worker | Browser UI |
|---|---:|---:|---:|
| PostgreSQL | Yes | Yes | Never |
| Redis/BullMQ | Yes | Yes | Never |
| Session/CSRF secrets | Yes | No | Never |
| Scraper browser limits | No | Yes | Never |
| Public API URL | No | No | Yes |
| Demo/live feature flags | Yes | Yes | Yes (display only) |

The API remains the authority. A `VITE_ENABLE_LIVE_SCRAPING=true` value only enables UI presentation; it must never override API authorization or `ALLOW_LIVE_SCRAPING`.

## Production differences

- Use `NODE_ENV=production`.
- Set `LOG_LEVEL=info`.
- Set `TRUST_PROXY=true` only when the API is actually behind a trusted reverse proxy.
- Set `SESSION_COOKIE_SECURE=true` and serve web/API through HTTPS.
- Keep `SESSION_COOKIE_SAME_SITE=lax` for same-site deployment. Re-evaluate cookies and CSRF controls if web and API are deployed cross-site.
- Set `DEMO_MODE=false` only for an operator-controlled deployment.
- Start with `WORKER_CONCURRENCY=1`; increase only after measuring browser memory and source behavior.
- Use `rediss://` when the hosted Redis provider requires TLS.
- Never run migrations automatically on every application boot; execute the reviewed migration command during release.

## Secret handling rules

- Never commit `.env`, service-account JSON, database URLs, Redis URLs, passwords, cookies, or tokens.
- Never expose backend variables using a `VITE_` prefix.
- Rotate the original Firebase configuration/project access before making the portfolio repository public.
- Use separate development and production credentials.
- Keep the repository private until the sanitization and secret-history audit is complete.
