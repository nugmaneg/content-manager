FROM node:22-alpine AS base
WORKDIR /app
ENV npm_config_optional=false
RUN apk add --no-cache python3 make g++

# Install all dependencies (including dev) for building
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Build the core app
FROM deps AS build
COPY . .
RUN npx nest build core

# Runtime image with production deps only
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/apps/core/apps/core/src/main.js"]
