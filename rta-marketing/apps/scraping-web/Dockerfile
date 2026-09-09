FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/dealership-api/package.json apps/dealership-api/package.json
COPY apps/dealership-web/package.json apps/dealership-web/package.json
COPY apps/scraping-api/package.json apps/scraping-api/package.json
COPY apps/scraping-web/package.json apps/scraping-web/package.json
COPY apps/scraping-worker/package.json apps/scraping-worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/scrapers/package.json packages/scrapers/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --include=dev

COPY apps/scraping-web apps/scraping-web
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build --workspace=@rta/scraping-web

FROM nginx:1.27-alpine
COPY apps/scraping-web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/scraping-web/dist /usr/share/nginx/html
EXPOSE 80
