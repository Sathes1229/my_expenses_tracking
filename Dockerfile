# syntax=docker/dockerfile:1

# Node 26 is the current LTS line. The Debian slim image is published for linux/amd64 and
# linux/arm64, and better-sqlite3 and sharp ship prebuilt native files for both.
FROM node:26-trixie-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# STANDALONE_BUILD turns on output: 'standalone' in next.config.ts for this build only.
# The empty public folder keeps the COPY below working until the app has static files.
RUN STANDALONE_BUILD=1 npm run build && mkdir -p public

FROM base AS run
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3100 \
    DATABASE_PATH=/data/app.db \
    UPLOADS_DIR=/data/uploads
RUN mkdir /data && chown node:node /data
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# instrumentation.ts runs these at start; server.js works from /app, so ./drizzle resolves here.
COPY --from=build --chown=node:node /app/drizzle ./drizzle
USER node
EXPOSE 3100
CMD ["node", "server.js"]
