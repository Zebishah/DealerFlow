FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/dealership-api/package.json apps/dealership-api/package.json
COPY apps/dealership-web/package.json apps/dealership-web/package.json
COPY apps/scraping-api/package.json apps/scraping-api/package.json
COPY apps/scraping-worker/package.json apps/scraping-worker/package.json
COPY apps/scraping-web/package.json apps/scraping-web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/scrapers/package.json packages/scrapers/package.json
RUN npm ci --include=dev
COPY tsconfig.base.json ./
COPY apps/scraping-worker/tsconfig.json apps/scraping-worker/tsconfig.json
COPY apps/scraping-worker/src apps/scraping-worker/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src
COPY packages/db/tsconfig.json packages/db/tsconfig.json
COPY packages/db/src packages/db/src
COPY packages/scrapers/tsconfig.json packages/scrapers/tsconfig.json
COPY packages/scrapers/src packages/scrapers/src
RUN npm run build:scraping-worker

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
COPY --from=build /app ./
CMD ["node", "apps/scraping-worker/dist/index.js"]
