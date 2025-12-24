FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++ dumb-init
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx nest build ai-service

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
USER node
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist/apps/ai-service ./dist/apps/ai-service
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://127.0.0.1:3002/ai/health', (r)=>{process.exit(r.statusCode===200?0:1)})" || exit 1
ENTRYPOINT ["/usr/bin/dumb-init","--"]
CMD ["node","dist/apps/ai-service/apps/ai-service/src/main.js"]
