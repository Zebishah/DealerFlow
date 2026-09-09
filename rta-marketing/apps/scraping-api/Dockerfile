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
COPY apps/scraping-api/tsconfig.json apps/scraping-api/tsconfig.json
COPY apps/scraping-api/src apps/scraping-api/src
COPY packages/shared/tsconfig.json packages/shared/tsconfig.json
COPY packages/shared/src packages/shared/src
COPY packages/db/tsconfig.json packages/db/tsconfig.json
COPY packages/db/src packages/db/src
RUN npm run build:scraping-api

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/dealership-api/package.json apps/dealership-api/package.json
COPY apps/dealership-web/package.json apps/dealership-web/package.json
COPY apps/scraping-api/package.json apps/scraping-api/package.json
COPY apps/scraping-worker/package.json apps/scraping-worker/package.json
COPY apps/scraping-web/package.json apps/scraping-web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/scrapers/package.json packages/scrapers/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/apps/scraping-api/dist apps/scraping-api/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/db/dist packages/db/dist
EXPOSE 4000
CMD ["node", "apps/scraping-api/dist/index.js"]
