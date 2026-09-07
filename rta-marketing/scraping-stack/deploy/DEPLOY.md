# Oracle Cloud deployment

This stack targets an Oracle Cloud Always Free Ampere A1 VM running Ubuntu 22.04. Docker Compose runs Redis, the API, and the worker; Neon provides PostgreSQL. The existing RTA AWS/SQS/Lambda implementation is separate and is not changed.

## Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker compose version
```

## Deploy

```bash
git clone YOUR_REPOSITORY_URL
cd rta-mark/rta-marketing/scraping-stack
cp .env.example .env
${EDITOR:-nano} .env
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:4000/health
```

Set the Neon `DATABASE_URL`, `CORS_ORIGIN`, `SCRAPER_USER_AGENT`, and `SCRAPER_SITES_JSON` in `.env` before starting. The checked-in example enables PakWheels, OLX Pakistan, and the clearly labeled synthetic demo source; Gari.pk is intentionally excluded because its terms prohibit automated scraping, and Hamariweb remains unverified. The API container runs `drizzle-kit migrate` against Neon before starting. Docker's `restart: always` replaces PM2 crash recovery.

## Nginx and HTTPS

Install Nginx, copy `nginx.conf` to `/etc/nginx/sites-available/rta-scraping`, replace the example hostname, enable it, and point DNS to the VM:

```bash
sudo apt-get install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/rta-scraping
sudo ln -s /etc/nginx/sites-available/rta-scraping /etc/nginx/sites-enabled/rta-scraping
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d scraping.example.com
```

The VM should expose only SSH, HTTP, and HTTPS. The worker and Redis ports do not need to be public.

## Operations

```bash
docker compose logs -f worker
docker compose logs -f api
docker compose down
```

The free A1 tier is suitable for a portfolio deployment but has limited availability. A production service should use a paid VM or managed database with monitoring and backups.
