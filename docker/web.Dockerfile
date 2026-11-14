# syntax=docker/dockerfile:1
#
# Web image: the built landing page and app, served by nginx, with /api proxied to the API.
# Build context is the repo root:  docker build -f docker/web.Dockerfile .
# (The app imports content/*.json from outside web/, so the context cannot be web/.)

# ---- Stage 1: build the static site ----------------------------------------
FROM node:22-alpine AS build

WORKDIR /repo

# Install dependencies from the lockfile before copying source, for layer caching.
COPY web/package.json web/package-lock.json ./web/
RUN cd web && npm ci --no-audit --no-fund

COPY web ./web
COPY content ./content
RUN cd web && npm run build

# ---- Stage 2: serve it ------------------------------------------------------
FROM nginx:1.27-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1
