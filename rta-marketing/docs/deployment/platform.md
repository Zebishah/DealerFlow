# Deployment overview

RTA has a live dealership path and a preserved reference path. The dealership
dashboard uses Apify for approved international scraping; the AWS SQS/Lambda
and BullMQ/Redis/Azure implementations remain available for portfolio
inspection and legacy operation.

## Production topology

```text
dealership-web  → dealership-api → Apify Actor (on-demand) → approved sources
                    ├────────────→ Neon PostgreSQL (durable data)
                    └────────────↔ Upstash Redis (limits, quotas, read cache)
```

Preserved legacy/reference topology; not used by the current Apify dashboard:

```text
scraping-web    → scraping-api → Northflank Redis → scraping-worker on Azure
                                  └───────────────→ Neon
```

## Main dealership application

The AWS SAM template is in `infrastructure/aws/template.yaml`. Its function
source is `apps/dealership-api`. The SQS, DLQ, Lambda, S3, and Neon assets remain
available for inspection and validation, but the SAM event mappings default to
disabled. Set `EnableSqsTrigger=true` only for an intentional AWS showcase run.

From the monorepo root:

```bash
cd rta-marketing
npm ci
npm run build --workspace=@rta/dealership-api
sam validate --lint --template-file infrastructure/aws/template.yaml
sam build --template-file infrastructure/aws/template.yaml
```

Use the direct Neon migration URL for migrations and keep database migrations
out of every normal dealership API startup.

## Scraping application

Follow [the scraping deployment guide](scraping.md) for the exact Vercel,
Render, Northflank, Azure, Neon, GHCR, and environment configuration.

Current dealership scrapes run as ephemeral Apify Actor jobs on demand; there
is no continuously running scraper worker or Redis job queue in that path. The
older scraping stack remains a separate reference topology and should stay
stopped unless deliberately reactivated.

## Secrets and cost controls

Keep all `.env` files outside Git. Never put Neon URLs, Redis credentials,
AWS credentials, scrape tokens, or Azure SSH keys into browser-safe variables.
Set budget alerts for AWS, Azure, Render, Northflank, Vercel, and Neon accounts
according to the limits of the selected plans.
