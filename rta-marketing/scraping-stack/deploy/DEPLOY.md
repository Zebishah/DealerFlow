# Oracle Cloud deployment

This stack targets an Oracle Cloud Always Free Ampere A1 VM running Ubuntu 22.04. Docker Compose runs a password-protected internal Redis, the scraping API, and the BullMQ worker; Neon provides PostgreSQL. The existing RTA AWS/SQS/Lambda implementation is separate and is not changed.

## Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker compose version
```

## Deploy Stage 1: Redis, scraping API, and worker

```bash
git clone YOUR_REPOSITORY_URL
cd rta-mark/rta-marketing/scraping-stack
cp .env.example .env
${EDITOR:-nano} .env
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --no-color --tail=100 worker
```

Set the Neon `DATABASE_URL`, a long random `REDIS_PASSWORD`, the final Vercel `CORS_ORIGIN`, `SCRAPER_USER_AGENT`, and `SCRAPER_SITES_JSON` in `.env` before starting. The checked-in example enables PakWheels, OLX Pakistan, and the clearly labeled synthetic demo source; Gari.pk is intentionally excluded because its terms prohibit automated scraping, and Hamariweb remains unverified. The API and worker connect to Redis at `redis:6379` on the private Compose network. The worker verifies Neon and Redis before writing `/tmp/rta-worker-ready`, which is used by the Compose healthcheck. Docker's `restart: always` replaces PM2 crash recovery.

Only the API is bound to the host, on `127.0.0.1:4000`; Nginx will proxy public HTTPS traffic to it in Stage 2. Redis has no host-published port and must not appear in any VCN or UFW ingress rule.

Verify the worker dependencies and readiness:

```bash
docker compose ps
docker compose exec redis sh -c 'redis-cli -a "$REDIS_PASSWORD" ping'
docker compose logs --no-color worker | grep "scraping worker started"
curl http://127.0.0.1:4000/health
```

Expected results are `PONG`, healthy `redis`, `worker`, and `api` containers, a worker log entry containing `database:connected` and `redis:connected`, and an API response with `"status":"ok"`, `"database":"ok"`, and `"redis":"ok"`.

## Nginx and HTTPS

Nginx is used only as the public HTTPS reverse proxy for the API. Redis remains internal to Docker.

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/rta-scraping
sudo ln -s /etc/nginx/sites-available/rta-scraping /etc/nginx/sites-enabled/rta-scraping
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

The VM should expose only SSH, HTTP, and HTTPS. Do not expose Redis, the worker, or any debug/admin port.

## Operations

```bash
docker compose logs -f worker
docker compose down
```

The free A1 tier is suitable for a portfolio deployment but has limited availability. A production service should use a paid VM or managed database with monitoring and backups.
