FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
COPY apps/dealership-api/package.json apps/dealership-api/package.json
COPY apps/dealership-web/package.json apps/dealership-web/package.json
COPY apps/scraping-api/package.json apps/scraping-api/package.json
COPY apps/scraping-web/package.json apps/scraping-web/package.json
COPY apps/scraping-worker/package.json apps/scraping-worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/scrapers/package.json packages/scrapers/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY apps/dealership-api/tsconfig.json apps/dealership-api/tsconfig.json
COPY apps/dealership-api/src apps/dealership-api/src
COPY apps/dealership-api/services apps/dealership-api/services
COPY apps/dealership-api/config apps/dealership-api/config
COPY apps/dealership-api/data apps/dealership-api/data
COPY apps/dealership-api/utils apps/dealership-api/utils
RUN npm run build --workspace=@rta/dealership-api

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
COPY apps/dealership-api/package.json apps/dealership-api/package.json
COPY apps/dealership-web/package.json apps/dealership-web/package.json
COPY apps/scraping-api/package.json apps/scraping-api/package.json
COPY apps/scraping-web/package.json apps/scraping-web/package.json
COPY apps/scraping-worker/package.json apps/scraping-worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/scrapers/package.json packages/scrapers/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/apps/dealership-api/dist ./apps/dealership-api/dist
COPY --from=build /app/apps/dealership-api/services ./apps/dealership-api/services
COPY --from=build /app/apps/dealership-api/config ./apps/dealership-api/config
COPY --from=build /app/apps/dealership-api/data ./apps/dealership-api/data
COPY --from=build /app/apps/dealership-api/utils ./apps/dealership-api/utils
USER node
EXPOSE 5000
CMD ["node", "apps/dealership-api/dist/server.js"]
