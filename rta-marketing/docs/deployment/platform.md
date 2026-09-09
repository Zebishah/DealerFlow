# Deployment overview

RTA has two production application paths. The dealership application keeps its
existing AWS SQS/Lambda architecture. The manual scraping application uses
Vercel, Render, Northflank, Azure, and Neon.

## Production topology

```text
dealership-web  → dealership-api → AWS SQS/Lambda → Neon

scraping-web    → scraping-api → Northflank Redis → scraping-worker on Azure
                                  └───────────────→ Neon
```

## Main dealership application

The AWS SAM template is in `infrastructure/aws/template.yaml`. Its function
source is `apps/dealership-api`, and the existing SQS, DLQ, Lambda, S3, and
Neon configuration remains independent of the scraping deployment.

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

The scraping worker is manual-only, limited to one active job, and runs with
the configured five-vehicle default and ten-vehicle maximum. Do not enable an
automatic schedule for the portfolio deployment.

## Secrets and cost controls

Keep all `.env` files outside Git. Never put Neon URLs, Redis credentials,
AWS credentials, scrape tokens, or Azure SSH keys into browser-safe variables.
Set budget alerts for AWS, Azure, Render, Northflank, Vercel, and Neon accounts
according to the limits of the selected plans.
