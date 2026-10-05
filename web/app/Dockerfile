# syntax=docker/dockerfile:1
# Web BFF (Next.js, standalone output). Build context = REPOSITORY ROOT (pnpm workspace):
#   docker build -f web/app/Dockerfile -t wip-web:local .
# Per-Dockerfile ignore rules live in web/app/Dockerfile.dockerignore (BuildKit).
# Nothing environment-specific is baked in: every address is read at request time (see .env.example).

ARG NODE_IMAGE=node:22-alpine

# ---- deps: workspace manifests + lockfile only, so this layer caches until dependencies change
FROM ${NODE_IMAGE} AS deps
# Optional build secret `cacert` (corporate/sandbox TLS-intercepting proxy); absent in normal builds.
RUN --mount=type=secret,id=cacert,required=false \
    if [ -f /run/secrets/cacert ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; fi; \
    npm install -g pnpm@12.9.1
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/app/package.json web/app/package.json
COPY tests/e2e/package.json tests/e2e/package.json
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=cacert,required=false \
    if [ -f /run/secrets/cacert ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; fi; \
    pnpm install --frozen-lockfile --filter work-in-poland-web...

# ---- builder
FROM ${NODE_IMAGE} AS builder
# Optional build secret `cacert` (corporate/sandbox TLS-intercepting proxy); absent in normal builds.
RUN --mount=type=secret,id=cacert,required=false \
    if [ -f /run/secrets/cacert ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/cacert; fi; \
    npm install -g pnpm@12.9.1
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/web/app/node_modules ./web/app/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY web/app ./web/app
RUN pnpm --filter work-in-poland-web build

# ---- runner
FROM ${NODE_IMAGE} AS runner
LABEL org.opencontainers.image.source=https://github.com/konradcinkusz/work-in-poland
LABEL org.opencontainers.image.description="work-in-poland web (Next.js BFF)"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001 -G nodejs
WORKDIR /app
# Standalone output is rooted at the workspace root (outputFileTracingRoot), so the app lives in web/app.
COPY --from=builder --chown=nextjs:nodejs /repo/web/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/web/app/.next/static ./web/app/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/web/app/public ./web/app/public
USER nextjs
EXPOSE 3000
# Fly uses its own /healthz check; this one serves plain `docker run` and compose.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null 2>&1 || exit 1
CMD ["node", "web/app/server.js"]
