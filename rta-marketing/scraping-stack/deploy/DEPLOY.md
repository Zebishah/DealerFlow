# Production deployment guide

This is the final low-cost portfolio architecture:

```text
Vercel frontend ──HTTPS──> Render API ──TLS BullMQ──> Northflank Redis addon
                                                        │
                                                        ▼
                              Azure Ubuntu VM: one Docker worker + Chromium
                                                        │
                                                        ▼
                                                  Neon PostgreSQL
```

The browser runs locally in the Azure worker image. Do not create a Cloud Run
service or a second Northflank worker. The primary RTA API under
`backend/src`, including its AWS SQS/Lambda configuration, is unrelated and
must remain unchanged.

## 0. Before creating anything

Confirm that the repository branch contains the final worker code:

```bash
git checkout portfolio-hardening
cd rta-marketing/scraping-stack
npm install
npm run build
```

Confirm that `.gitignore` excludes all environment files before pushing to a
public repository:

```bash
git check-ignore -v .env .env.local .env.production
```

Never paste `DATABASE_URL`, `REDIS_URL`, Redis passwords, or SSH private keys
into Git, a frontend variable, or a chat message.

## 1. Northflank Redis addon

Use the existing Redis addon in the `rta-redis` project/account. It should be
running, authenticated, TLS-enabled, and publicly reachable only through its
provider endpoint. Redis is the queue transport, not the durable data store.

Copy the addon’s complete TLS connection variable, preferably
`REDIS_MASTER_URI`, into the Render API and Azure worker as `REDIS_URL`. Use
the exact URI supplied by Northflank; do not manually replace its host, port,
username, or password.

The URL normally starts with `rediss://`. The application enables certificate
verification and SNI for TLS. Do not expose a Redis port from the Azure VM,
Render, Vercel, or an NSG rule.

The shared configuration still preserves the local fallback variables
`REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`. Hosted production uses only
the exact Northflank `REDIS_URL`; local Compose uses the fallback when
`REDIS_URL` is not set.

Test the URI from the Azure worker after it is deployed using the command in
the verification section below.

## 2. Render API producer

Create one Render Web Service from `Zebishah/Rta-mark`, branch
`portfolio-hardening`.

| Render setting | Value |
| --- | --- |
| Root directory | `rta-marketing/scraping-stack` |
| Runtime | Docker |
| Dockerfile path | `apps/api/Dockerfile` |
| Health check path | `/health` |
| Port environment | `API_PORT=10000` |
| Automatic deploys | Enabled if desired |

Set these runtime variables in Render. Mark URLs and credentials as secrets:

```text
NODE_ENV=production
DATABASE_URL=<Neon pooled connection string>
REDIS_URL=<exact Northflank rediss:// connection URL>
API_PORT=10000
CORS_ORIGIN=https://<final-vercel-domain>
SCRAPER_USER_AGENT=RTA-Portfolio-Scraper/1.0 (+https://<your-contact-domain>)
SCRAPER_SITES_JSON=<exact JSON from .env.example>
SCRAPE_DEFAULT_LIMIT=10
SCRAPE_MAX_LIMIT=20
WORKER_CONCURRENCY=1
MANUAL_SCRAPING_ONLY=true
SCRAPE_NAVIGATION_TIMEOUT_MS=30000
SCRAPE_SELECTOR_TIMEOUT_MS=15000
SCRAPE_JOB_TIMEOUT_MS=120000
SCRAPE_LOCK_TTL_SECONDS=900
```

The API only validates a source and enqueues `vehicle-scrape`; it does not
launch Chromium. After deployment, test:

```bash
curl --fail https://<render-service>.onrender.com/health
curl --fail https://<render-service>.onrender.com/api/sites
```

The health response must report both database and Redis as healthy. If Render
does not route to port 10000, confirm that the service variable is exactly
`API_PORT=10000` and redeploy; the application intentionally supports the
Render port through this setting.

## 3. Azure free-account checks

This project’s confirmed Azure target is the account-eligible BS-family
`Standard_B1s` VM. In the `rta-portfolio-subscription` subscription, the Azure
portal shows 750 free Linux VM hours per month for 12 months and the BS-family
quota is available. Do not switch this deployment to B2ats, Basv2, Bsv2, or
Bpsv2: those families are not the confirmed target for this subscription.

Still recheck **Subscriptions → Free services** before creating the VM. Azure
free-service eligibility is subscription-specific and usage reporting can lag.

Useful official pages:

- [Azure free account](https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account)
- [Check free service usage](https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/check-free-service-usage)
- [Azure cost alerts](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/cost-mgt-alerts-monitor-usage-spending)

The final worker size is:

```text
Standard_B1s
BS family
1 vCPU
1 GiB memory
```

This worker runs one job at a time. The deployment adds approximately 2 GiB of
Linux swap as a temporary safety margin for Chromium spikes; swap does not make
concurrent browser jobs safe.

## 4. Create the Azure VM

In **Azure Portal → Virtual machines → Create → Azure virtual machine**:

### Basics

Use these values:

| Field | Value |
| --- | --- |
| Subscription | `rta-portfolio-subscription` |
| Resource group | `rta-portfolio-rg` |
| VM name | `rta-worker` |
| Region | The region where `Standard_B1s` is available for this subscription |
| Availability options | No infrastructure redundancy required |
| Image | Ubuntu Server 24.04 LTS - x64 Gen2 |
| Size | `Standard_B1s` |
| Security type | Standard |
| Authentication | SSH public key |
| Username | `azureuser` |
| Inbound ports | SSH (22) only |
| Spot | Off |
| Backup | Off |

On Fedora, create a dedicated key before opening the VM form:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/azure_rta_worker -C rta-worker
chmod 700 ~/.ssh
chmod 600 ~/.ssh/azure_rta_worker
```

Paste the contents of `~/.ssh/azure_rta_worker.pub` into the Azure SSH public
key field. Keep the private key on Fedora only.

### Disks

Use the disk type and size shown as free in your subscription’s **Free
services** panel. The current Azure free offer commonly shows one small P6
64-GiB SSD allowance, but the portal is authoritative for your subscription.
Do not add a data disk, backup, snapshot, or another managed disk.

### Networking

Create or select:

```text
Virtual network: rta-worker-vnet
Subnet: default
Public IP: one IP only, for SSH and outbound access
Inbound NSG: allow TCP 22 from My IP only
```

Do not allow ports 4000, 6379, 80, or 443. The worker has no web server and
does not need an inbound application port. There is no load balancer, NAT
gateway, Bastion, VPN, AKS, Container Apps, managed Redis, or public Redis
endpoint in this design. Do not create a NAT Gateway unless the deployment
later proves that outbound connectivity requires it.

### Management and monitoring

Keep auto-shutdown disabled because the worker is intended to remain available
when you manually present the project. Do not enable paid Azure Monitor,
Log Analytics, Defender trials, Backup, or extra diagnostics unless you have
confirmed their free allowance and explicitly want them.

Do not attach extra data disks. The OS disk is the only disk required.

Create the VM, then copy its public IP from the Overview page. Recheck the VM
size, disk, public IP, and subscription against **Free services** before
continuing.

## 5. SSH from Fedora and install Docker

From Fedora, replace `<AZURE_PUBLIC_IP>`:

```bash
chmod 400 ~/.ssh/azure_rta_worker
ssh -i ~/.ssh/azure_rta_worker azureuser@<AZURE_PUBLIC_IP>
```

On the Ubuntu VM, install Docker Engine from Docker’s official repository:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc > /dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
newgrp docker
docker run --rm hello-world
```

Do not install a Redis server on this VM. The worker connects to Northflank
Redis over its authenticated TLS URL.

## 6. Add the small VM safety margin

On a 1-GiB VM, configure approximately 2 GiB of swap before running Chromium.
Swap is a safety margin for a short browser spike, not extra usable RAM:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Confirm that `/swapfile` appears after a reboot. Keep worker concurrency at one;
swap does not make concurrent browser jobs safe.

## 7. Build and run the Azure worker

Clone the repository on the VM:

```bash
git clone https://github.com/Zebishah/Rta-mark.git
cd Rta-mark
git checkout portfolio-hardening
cd rta-marketing/scraping-stack
```

Create the runtime environment file locally on the VM. Use `nano .env` and
paste the values from the Render setup; do not commit this file:

```text
NODE_ENV=production
DATABASE_URL=<same Neon pooled connection string>
REDIS_URL=<exact Northflank rediss:// connection URL>
SCRAPER_USER_AGENT=RTA-Portfolio-Scraper/1.0 (+https://<your-contact-domain>)
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
SCRAPER_SITES_JSON=<exact JSON from .env.example>
SCRAPE_DEFAULT_LIMIT=10
SCRAPE_MAX_LIMIT=20
WORKER_CONCURRENCY=1
MANUAL_SCRAPING_ONLY=true
SCRAPE_NAVIGATION_TIMEOUT_MS=30000
SCRAPE_SELECTOR_TIMEOUT_MS=15000
SCRAPE_JOB_TIMEOUT_MS=120000
SCRAPE_LOCK_TTL_SECONDS=900
```

The `SCRAPER_SITES_JSON` value must be one valid JSON string. Copy the complete
value from `.env.example`; do not replace it with a JavaScript object or a
multi-line unescaped value. Protect the file:

```bash
chmod 600 .env
docker compose config --quiet
```

Build the worker image from the scraping-stack directory:

```bash
docker build -f apps/worker/Dockerfile -t rta-worker:portfolio-hardening .
```

Run exactly one worker. No port is published:

```bash
docker run -d \
  --name rta-worker \
  --restart unless-stopped \
  --init \
  --env-file .env \
  --health-cmd='test -f /tmp/rta-worker-ready' \
  --health-interval=30s \
  --health-timeout=5s \
  --health-retries=3 \
  rta-worker:portfolio-hardening
```

The image installs Debian Chromium and starts
`node apps/worker/dist/index.js`. It has no public API port. Verify it:

```bash
docker ps
docker logs --tail=100 rta-worker
docker inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' rta-worker
```

Expected log text includes `scraping worker started`, `database: connected`,
and `redis: connected`.

Monitor the 1-GiB VM and confirm that Chromium is absent while the worker is
idle:

```bash
free -h
swapon --show
docker stats --no-stream rta-worker
docker exec rta-worker sh -c 'pgrep -af chromium || true'
```

The idle Chromium command should return no processes. It should only show a
Chromium process while a Playwright source is actively scraping.

## 8. Worker verification

### Redis TLS and authentication

Run this inside the worker image. A successful connection prints `PONG`:

```bash
docker exec rta-worker node --input-type=module -e 'import Redis from "ioredis"; import { createRedisConnectionConfig, loadConfig } from "@rta/shared"; const redis = new Redis({ ...createRedisConnectionConfig(loadConfig()), lazyConnect: true }); await redis.connect(); console.log(await redis.ping()); await redis.quit();'
```

### Chromium and Playwright

```bash
docker exec rta-worker /usr/bin/chromium --version
docker exec rta-worker node --input-type=module -e 'import { chromium } from "playwright"; const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }); console.log("PLAYWRIGHT_OK"); await browser.close();'
```

### Manual end-to-end run

From the Azure VM, enqueue one source through the worker image:

```bash
docker exec rta-worker node apps/worker/dist/enqueue-once.js --site=pakwheels
docker logs -f rta-worker
```

The API may also enqueue the job:

```bash
curl --fail -X POST https://<render-service>.onrender.com/api/scrape/pakwheels
```

The worker should log a completed job and the result should appear in Neon and
through `/api/sites`. Test the OLX source separately because it exercises the
browser path and may take longer or be affected by source-side availability.

For the API end-to-end path, use one request and watch the returned job:

```bash
curl --fail -X POST https://<render-service>.onrender.com/api/scrape/olx-pakistan \
  -H 'Content-Type: application/json' \
  -d '{"limit":10}'
docker logs -f rta-worker
curl --fail https://<render-service>.onrender.com/api/sites
```

The response must contain one `jobId`. The dashboard should show `Queued`,
then `Scraping`, then `Completed` or `Failed`. While it is active, another
source request should receive HTTP 409 rather than starting a second scrape.
Verify the server-side hard cap with:

```bash
curl --fail -X POST https://<render-service>.onrender.com/api/scrape/pakwheels \
  -H 'Content-Type: application/json' \
  -d '{"limit":999}'
```

The returned job data must show `limit: 20` or less.

## 9. Vercel frontend

Create a Vercel project from `Zebishah/Rta-mark`:

| Vercel setting | Value |
| --- | --- |
| Root directory | `rta-marketing/scraping-stack/apps/frontend` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `VITE_API_URL=https://<render-service>.onrender.com` |

After Vercel gives the final production URL, set the same URL as Render’s
`CORS_ORIGIN` and redeploy Render. Confirm the browser Network panel shows
successful API calls with no CORS errors.

## 10. Cost controls and rollback

Set a small Azure budget and email alert from **Cost Management → Budgets**.
Also check **Subscriptions → Free services** at least once per day during the
first deployment week. Usage reporting can lag, so do not assume that a blank
meter means no cost.

For this portfolio worker, avoid adding Azure services that are not required:

- no second VM or VM scale set;
- no Azure Database, Redis, Backup, Bastion, NAT Gateway, Load Balancer, or
  Log Analytics workspace;
- no extra managed disks or snapshots;
- no public inbound port except restricted SSH.

Tag every image before upgrading:

```bash
docker build -f apps/worker/Dockerfile -t rta-worker:2026-09-09 .
docker stop rta-worker
docker rename rta-worker rta-worker-previous
docker run -d --name rta-worker --restart unless-stopped --init --env-file .env rta-worker:2026-09-09
```

If the new worker fails, restore the previous image:

```bash
docker rm -f rta-worker
docker rename rta-worker-previous rta-worker
docker start rta-worker
```

Keep only a small number of old images and remove them deliberately after the
new deployment is verified. Do not remove the previous image until rollback is
no longer needed.

## 11. Final checklist

- [ ] Northflank Redis is authenticated and TLS-enabled.
- [ ] Render `/health` reports Neon and Redis healthy.
- [ ] Azure VM is `rta-worker`, `Standard_B1s`, Ubuntu 24.04 x64 Gen2, Standard security.
- [ ] Azure resource group is `rta-portfolio-rg` under `rta-portfolio-subscription`.
- [ ] Azure VM has approximately 2 GiB swap and no extra data disk.
- [ ] Azure NSG allows only SSH 22 from your IP; no 4000/6379/80/443 inbound.
- [ ] One worker container is running with `--restart unless-stopped`.
- [ ] Worker has no published ports and reports `scraping worker started`.
- [ ] Redis test prints `PONG` from inside the worker.
- [ ] Chromium and Playwright smoke tests pass inside the worker.
- [ ] A manual PakWheels job reaches Neon.
- [ ] A manual OLX job exercises the browser path.
- [ ] Vercel calls the Render API without CORS errors.
- [ ] No Cloud Run or Account 2 Northflank worker remains in production.
- [ ] The primary AWS SQS/Lambda code under `backend/src` is unchanged.
