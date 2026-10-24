FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
RUN npm ci
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

FROM base AS api-builder
RUN npm run build --workspace @taskforge/api

FROM base AS web-builder
RUN npm run build --workspace @taskforge/web

FROM node:24-alpine AS api
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/apps/api/package*.json ./apps/api/
COPY --from=api-builder /app/apps/api/dist ./apps/api/dist
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@taskforge/api"]

FROM node:24-alpine AS web
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/apps/web/package*.json ./apps/web/
COPY --from=web-builder /app/apps/web/.next ./apps/web/.next
COPY --from=web-builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@taskforge/web"]
