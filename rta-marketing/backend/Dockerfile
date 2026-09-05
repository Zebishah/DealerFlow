FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY services ./services
COPY config ./config
COPY data ./data
COPY utils ./utils
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/services ./services
COPY --from=build /app/config ./config
COPY --from=build /app/data ./data
COPY --from=build /app/utils ./utils
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
