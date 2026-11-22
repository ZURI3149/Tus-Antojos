# syntax=docker/dockerfile:1
# Imagen de la Web (React PWA + Vite). Se construye desde la RAÍZ del monorepo:
#   docker build -f apps/web/Dockerfile -t tus-antojos-web .

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# --- Dependencias y build -----------------------------------------------------
FROM base AS build
# Manifiestos primero para aprovechar el caché de capas de pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @tus-antojos/web...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# Variables públicas para Vite (se incrustan durante el build en el bundle del cliente)
ARG VITE_SUPABASE_URL=http://localhost:54321
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_API_URL=http://localhost:3000
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_ENVIRONMENT=""
ARG VITE_APP_VERSION="docker"

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_URL=$VITE_API_URL \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_ENVIRONMENT=$VITE_SENTRY_ENVIRONMENT \
    VITE_APP_VERSION=$VITE_APP_VERSION

RUN pnpm --filter @tus-antojos/shared build \
 && pnpm --filter @tus-antojos/web build

# --- Servidor Nginx de producción ---------------------------------------------
FROM nginx:1.27-alpine-slim AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:80/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
