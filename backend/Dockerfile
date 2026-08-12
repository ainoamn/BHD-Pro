# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY src/prisma ./src/prisma/
RUN npm ci
RUN npx prisma generate

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/src/prisma ./src/prisma
COPY --chown=node:node package.json ./
EXPOSE 3001
# Database migration runs once in the release/migrate job, never in every replica.
USER node
CMD ["node", "--max-old-space-size=384", "dist/main"]
