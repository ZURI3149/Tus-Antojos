# syntax=docker/dockerfile:1
# Imagen de la API (NestJS). Se construye desde la RAÍZ del monorepo:
#   docker build -f apps/api/Dockerfile -t tus-antojos-api .
# Las variables de entorno (Supabase, Sentry...) se inyectan en tiempo de ejecución,
# nunca en la imagen.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# --- Dependencias y build -----------------------------------------------------
FROM base AS build
# Primero solo los manifiestos: la capa de dependencias se reutiliza si no cambian.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @tus-antojos/api...

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @tus-antojos/shared build \
 && pnpm --filter @tus-antojos/api build \
 && pnpm --filter @tus-antojos/api deploy --prod --legacy /out

# --- Imagen final: solo dist y dependencias de producción ---------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
