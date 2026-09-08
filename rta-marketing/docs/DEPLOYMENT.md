# Free-tier deployment guide

The production topology has two separate application paths: the primary RTA
API continues to use Neon, Amazon SQS/DLQ, and AWS Lambda; the scraping stack
runs as an Oracle Docker Compose deployment containing Redis, the scraping API,
and the BullMQ worker. The browser frontend is deployed to Vercel. Neon is the
database for both application paths.

## Lambda Chromium layer

Live Lambda scraping uses `puppeteer-core@25.1.0` with the matching
`@sparticuz/chromium@149.0.0` runtime. Publish the official x86_64 Node 22
layer asset in the deployment account, then pass its version ARN as the
`ChromiumLayerArn` SAM parameter. The worker keeps `@sparticuz/chromium`
external to the esbuild bundle so Node resolves it from `/opt/nodejs/node_modules`.
Local workers instead require `BROWSER_EXECUTABLE_PATH` pointing to an
installed Chrome/Chromium executable.

The template can deploy without the optional layer while live scraping remains
disabled. Do not enable `LIVE_SCRAPING_ENABLED` until the layer ARN has been
configured and a one-source smoke test succeeds.

## CloudWatch alarms

The SAM stack defines an SNS topic and alarms for worker errors, throttles,
p95 duration, SQS message age, SQS visible backlog, DLQ messages, and
dead-letter reconciler errors. The stack deliberately creates no email
subscription. Add a confirmed subscription separately when an operator
address has been chosen.

## 1. Database release

From a trusted local machine, set the direct Neon migration URL and run:

```bash
cd backend
npm ci
DATABASE_MIGRATION_URL='YOUR_DIRECT_NEON_URL' npm run db:migrate
DATABASE_URL='YOUR_POOLED_NEON_URL' SEED_OPERATOR_EMAIL='you@example.com' SEED_OPERATOR_PASSWORD='a-long-unique-password' npm run db:seed
```

Do not run migrations automatically on every primary API startup.

## 2. Oracle scraping stack

On the Oracle VM, deploy the three scraping-stack services together:

```bash
cd rta-marketing/scraping-stack
cp .env.example .env
${EDITOR:-nano} .env
docker compose config --quiet
docker compose up -d --build --force-recreate
docker compose ps
```

Set `DATABASE_URL` to Neon, choose a strong `REDIS_PASSWORD`, and set
`CORS_ORIGIN` to the final Vercel URL. Redis has no published host port. The
scraping API is bound to `127.0.0.1:4000` for host Nginx; the worker and API
reach Redis at `redis:6379` through the private Compose network.

## 3. Nginx and HTTPS

Install Nginx on the Oracle host and proxy the API container:

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp scraping-stack/deploy/nginx.conf /etc/nginx/sites-available/rta-scraping
sudo ln -s /etc/nginx/sites-available/rta-scraping /etc/nginx/sites-enabled/rta-scraping
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

Allow only SSH, HTTP, and HTTPS in the Oracle VCN and UFW rules. Do not open
Redis, the worker, or port 4000 publicly.

## 4. Vercel frontend

Deploy the scraping frontend with the Vite preset and set
`VITE_API_URL=https://YOUR_DOMAIN`. Configure the same URL as `CORS_ORIGIN`
in the Oracle `.env`, recreate the API container, and verify the browser has
no CORS errors.

## 5. Private employee documents

Create a dedicated S3 bucket in the API region. Enable **Block all public access**, leave ACLs disabled, and use default server-side encryption. Set `S3_DOCUMENT_BUCKET` to the bucket name—not its ARN or URL.

Add this statement to the primary API IAM policy, replacing the bucket name:

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
  "Resource": "arn:aws:s3:::YOUR_PRIVATE_BUCKET/documents/*"
}
```

The browser never receives AWS credentials. The API authorizes a request and creates a five-minute pre-signed URL; S3 then accepts only the signed method, key, content type, size and encryption headers.

Configure bucket CORS with the exact frontend origins:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://YOUR-FRONTEND.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type", "x-amz-server-side-encryption"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 300
  }
]
```

Never make the bucket public. Download links are short-lived and generated only after workspace/owner authorization.

## 6. Lambda workers

Export both queue ARNs before deployment:

```bash
export RTA_QUEUE_ARN='arn:aws:sqs:ap-south-1:YOUR_ACCOUNT_ID:rta-scrape-jobs'
export RTA_DLQ_ARN='arn:aws:sqs:ap-south-1:YOUR_ACCOUNT_ID:rta-scrape-jobs-dlq'
```

Pass both parameters when updating the stack:

```bash
sam build --template-file template.yaml
sam deploy \
  --stack-name rta-scrape-worker \
  --region ap-south-1 \
  --profile rta-deploy \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    ScrapeQueueArn="$RTA_QUEUE_ARN" \
    ScrapeDlqArn="$RTA_DLQ_ARN" \
    DatabaseUrl="$RTA_DATABASE_URL" \
    LiveScrapingEnabled=false
```

Install the backend dependencies before building because SAM's esbuild builder resolves the local binary from `node_modules/.bin`:

```bash
cd rta-marketing/backend
npm ci
cd ../infrastructure/aws
PATH="$(pwd)/../../backend/node_modules/.bin:$PATH" sam build --template-file template.yaml
```

Deploy the worker as a Lambda-compatible artifact whose handler is `lambda.handler` in the generated SAM bundle. Configure:

- Runtime: Node.js 22
- Architecture: x86_64
- Timeout: 10 minutes
- Memory: start at 1024 MB and measure
- SQS maximum concurrency: `2` (the template does not reserve account concurrency)
- SQS trigger batch size: `1`
- Batch window: `0`
- Enable partial batch response (`ReportBatchItemFailures`)
- Queue visibility timeout: at least 6× the Lambda timeout
- Queue redrive: send to the DLQ after 3 receives
- Keep `LiveScrapingEnabled=false` unless live browser automation has been verified.
- Set `ChromiumLayerArn` only when a Lambda-compatible `@sparticuz/chromium` layer is available; the parameter is optional for fixture mode.

SAM creates separate least-privilege execution roles for the ingestion worker and the DLQ reconciler. The ingestion Lambda consumes the main queue. The reconciler consumes terminal DLQ messages, records `dead_letter` in PostgreSQL, and recomputes the parent acquisition run so the dashboard cannot remain falsely active. Lambda receives messages through event-source mappings; do not run the local long-polling process in Lambda.

For fixture mode, no browser is launched and no Chromium layer is required. Before enabling live mode, set `LiveScrapingEnabled=true`, provide `ChromiumLayerArn` when using a layer, confirm that the runtime has a compatible Chromium executable, confirm source terms/robots expectations, run parser fixtures, and verify one adapter at a time. Never turn on live mode merely because the Lambda stack deploys successfully.

## 6. Final checks

1. Open API `/health/live` and `/health/ready`.
2. Open the dashboard and run fixture acquisition.
3. Confirm four SQS messages are processed and the queue returns to zero.
4. Confirm one completed run and populated catalog in PostgreSQL.
5. Run the same fixture again and confirm listing count remains stable while observations increase.
6. Upload a small PDF as the employee user, verify it as admin, and confirm an unauthorized role cannot list or download it.
7. Force a disposable test message through the maximum receive count and confirm the reconciler marks its source run `dead_letter`.
8. Confirm DLQ/Lambda CloudWatch alarms and AWS Budget alerts are active.

Neon may suspend idle compute, and AWS free-tier eligibility depends on account
and region. The architecture minimizes idle work, but “free” is a quota, not an
unlimited guarantee.
