# Free-tier deployment guide

The intended topology is a Render static frontend, a Render free web API, Neon PostgreSQL, Amazon SQS/DLQ, and an AWS Lambda worker. Free tiers have limits and can change; configure AWS Budgets before enabling live work.

## 1. Database release

From a trusted local machine, set the direct Neon migration URL and run:

```bash
cd backend
npm ci
DATABASE_MIGRATION_URL='YOUR_DIRECT_NEON_URL' npm run db:migrate
DATABASE_URL='YOUR_POOLED_NEON_URL' SEED_OPERATOR_EMAIL='you@example.com' SEED_OPERATOR_PASSWORD='a-long-unique-password' npm run db:seed
```

Do not run migrations automatically on every Render startup.

## 2. Render API

Create a Web Service from this repository:

- Root directory: `backend`
- Runtime: Node
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/health/ready`
- Plan: Free

Add the API variables from `backend/.env.example`. Use a dedicated IAM producer policy that allows only `sqs:SendMessage` and `sqs:GetQueueAttributes` on the main queue. It must not receive or delete messages.

## 3. Render frontend

Create a Static Site:

- Root directory: `rta-scrapper`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_URL=https://YOUR-API.onrender.com/api/v1`

Add a rewrite from `/*` to `/index.html` if client-side routes are introduced later.

## 4. Lambda worker

Build/deploy the worker as a Lambda-compatible artifact whose handler is `dist/worker/lambda.handler`. Configure:

- Runtime: Node.js 22
- Architecture: x86_64
- Timeout: 10 minutes
- Memory: start at 1024 MB and measure
- Reserved concurrency: `1`
- SQS trigger batch size: `1`
- Batch window: `0`
- Enable partial batch response (`ReportBatchItemFailures`)
- Queue visibility timeout: at least 6× the Lambda timeout
- Queue redrive: send to the DLQ after 3 receives

Attach a least-privilege execution role with CloudWatch Logs and SQS consumer actions on the main queue. Lambda receives SQS messages through the trigger; do not run the local long-polling process in Lambda.

For fixture mode, no browser is launched. Before enabling live mode, package a Lambda-compatible Chromium binary/layer, confirm source terms/robots expectations, run parser fixtures, and verify one adapter at a time.

## 5. Final checks

1. Open API `/health/live` and `/health/ready`.
2. Open the dashboard and run fixture acquisition.
3. Confirm four SQS messages are processed and the queue returns to zero.
4. Confirm one completed run and populated catalog in PostgreSQL.
5. Run the same fixture again and confirm listing count remains stable while observations increase.
6. Confirm DLQ CloudWatch alarm and AWS Budget alerts are active.

Render free services may sleep, Neon may suspend idle compute, and AWS free-tier eligibility depends on account and region. The architecture minimizes idle work, but “free” is a quota, not an unlimited guarantee.
