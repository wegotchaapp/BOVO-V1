# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install OS-level build tools required for bcrypt native bindings
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Remove dev dependencies; keep only production node_modules
RUN npm prune --production

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy compiled output and production-only modules with correct ownership
COPY --from=builder --chown=node:node /app/dist        ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./

# Run as the unprivileged node user provided by the base image
USER node

ENV NODE_ENV=production

EXPOSE 3000

# Readiness probe — Alpine ships wget; matches the /health endpoint in the app
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
