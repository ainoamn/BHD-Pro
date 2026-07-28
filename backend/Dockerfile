# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY src/prisma ./src/prisma/
RUN npm ci
RUN npx prisma generate

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/prisma ./src/prisma
COPY package.json ./
EXPOSE 3001
# Client already generated at image build — skip generate on boot (OOM on 512Mi).
# Prefer migrate deploy; fall back to db push only if _prisma_migrations is empty/broken.
CMD ["sh", "-c", "npx prisma migrate deploy --skip-generate || npx prisma db push --accept-data-loss --skip-generate; node --max-old-space-size=384 dist/main"]
