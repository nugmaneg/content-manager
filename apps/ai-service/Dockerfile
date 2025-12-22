FROM node:22-alpine AS base
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init

FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build ai-service

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /usr/src/app

COPY package*.json package-lock.json ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
RUN npm prune --omit=dev && npm cache clean --force

COPY --from=build /usr/src/app/dist/apps/ai-service ./dist/apps/ai-service

EXPOSE 3000
CMD ["dumb-init", "node", "dist/apps/ai-service/apps/ai-service/src/main.js"]
