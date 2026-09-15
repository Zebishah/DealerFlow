FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/dealership-api/package.json apps/dealership-api/package.json
COPY apps/dealership-web/package.json apps/dealership-web/package.json
COPY apps/scraping-api/package.json apps/scraping-api/package.json
COPY apps/scraping-worker/package.json apps/scraping-worker/package.json
COPY apps/scraping-web/package.json apps/scraping-web/package.json
COPY apps/scraping-actor/package.json apps/scraping-actor/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/scrapers/package.json packages/scrapers/package.json
RUN npm ci --include=dev
COPY tsconfig.base.json ./
COPY apps/scraping-actor/tsconfig.json apps/scraping-actor/tsconfig.json
COPY apps/scraping-actor/src apps/scraping-actor/src
COPY apps/scraping-actor/.actor apps/scraping-actor/.actor
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src
COPY packages/db/tsconfig.json packages/db/tsconfig.json
COPY packages/db/src packages/db/src
COPY packages/scrapers/tsconfig.json packages/scrapers/tsconfig.json
COPY packages/scrapers/src packages/scrapers/src
RUN npm run build:scraping-actor

# This source uses the Cheerio runtime. Do not install a Playwright browser in
# the Actor image; the existing Playwright dependency remains for OLX only.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
CMD ["node", "apps/scraping-actor/dist/index.js"]
