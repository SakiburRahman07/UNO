# syntax=docker/dockerfile:1

# ---- Builder: install deps & build the Next.js app ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- Runner: run the custom Next.js + Socket.IO server via tsx ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# tsx transpiles the custom server from TypeScript source at runtime,
# so the source tree must be present alongside the built .next output.
COPY --from=builder /app ./
# Drop dev-only caches to slim the image a little.
RUN rm -rf .next/cache 2>/dev/null || true

EXPOSE 3000
CMD ["node", "node_modules/tsx/dist/cli.mjs", "server/index.ts"]
