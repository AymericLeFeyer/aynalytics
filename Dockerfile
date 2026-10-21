# syntax=docker/dockerfile:1
# Un seul Dockerfile, deux images :
#   docker build --target collector -t aynalytics-collector .
#   docker build --target dashboard -t aynalytics-dashboard .

ARG NODE_IMAGE=node:24-bookworm-slim

# ---------- Build de tout le monorepo ----------
FROM ${NODE_IMAGE} AS build
# Outils de compilation au cas ou le binaire precompile de better-sqlite3 serait indisponible.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/sdk/package.json packages/sdk/
COPY apps/collector/package.json apps/collector/
COPY apps/dashboard-api/package.json apps/dashboard-api/
COPY apps/dashboard-web/package.json apps/dashboard-web/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm run build

# ---------- Dependances de production (natives incluses) ----------
FROM ${NODE_IMAGE} AS deps-base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/sdk/package.json packages/sdk/
COPY apps/collector/package.json apps/collector/
COPY apps/dashboard-api/package.json apps/dashboard-api/
COPY apps/dashboard-web/package.json apps/dashboard-web/

FROM deps-base AS deps-collector
RUN npm ci --omit=dev --workspace @aynalytics/collector

FROM deps-base AS deps-dashboard
RUN npm ci --omit=dev --workspace @aynalytics/dashboard-api

# ---------- Runtime commun ----------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    DATA_DIR=/data
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]

# ---------- Image collector (publique, derriere reverse proxy HTTPS) ----------
FROM runtime AS collector
ENV PORT=8080 \
    SDK_DIR=/app/sdk
COPY --chown=root:root apps/collector/package.json ./package.json
COPY --from=deps-collector --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /repo/apps/collector/dist ./dist
COPY --from=build --chown=root:root /repo/packages/sdk/dist/aynalytics.global.js ./sdk/aynalytics.global.js
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]

# ---------- Image dashboard (interne, VPN uniquement) ----------
FROM runtime AS dashboard
ENV PORT=8081 \
    WEB_DIST=/app/web
COPY --chown=root:root apps/dashboard-api/package.json ./package.json
COPY --from=deps-dashboard --chown=root:root /app/node_modules ./node_modules
COPY --from=build --chown=root:root /repo/apps/dashboard-api/dist ./dist
COPY --from=build --chown=root:root /repo/apps/dashboard-web/dist ./web
EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server.js"]
