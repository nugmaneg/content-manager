FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++ dumb-init
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
# Генерируем Prisma Client перед билдом
RUN npx prisma generate --schema=apps/database/prisma/schema.prisma
RUN npx nest build database

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++ \
    && npm ci --omit=dev \
    && npm cache clean --force

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init
RUN mkdir -p /app/logs && chown -R node:node /app/logs
USER node
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist/apps/database ./dist/apps/database
# Копируем сгенерированный Prisma Client
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
# Копируем схему для миграций (если понадобится)
COPY --from=build --chown=node:node /app/apps/database/prisma ./prisma
# Копируем gRPC proto файлы
COPY --from=build --chown=node:node /app/libs/grpc-contracts ./libs/grpc-contracts
EXPOSE 3003 50051
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD node -e "require('http').get('http://127.0.0.1:3003/health', (r)=>{process.exit(r.statusCode===200?0:1)})" || exit 1
ENTRYPOINT ["/usr/bin/dumb-init","--"]
CMD ["node","dist/apps/database/main.js"]
