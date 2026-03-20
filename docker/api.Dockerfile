FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g npm@latest

# ─── Install dependencies ─────────────────────────────────────
FROM base AS deps
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/ha-client/package.json ./packages/ha-client/
COPY apps/api/package.json ./apps/api/
RUN npm install --workspaces --include-workspace-root

# ─── Build shared packages ────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/ha-client ./packages/ha-client
COPY apps/api ./apps/api
RUN npm run build -w packages/shared
RUN npm run build -w packages/ha-client
RUN npm run build -w apps/api

# ─── Production image ─────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
# Copy full package dirs so workspace symlinks in node_modules resolve correctly
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/ha-client/package.json ./packages/ha-client/package.json
COPY --from=build /app/packages/ha-client/dist ./packages/ha-client/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/

# Generate Prisma client for production
WORKDIR /app/apps/api
RUN npx prisma generate

EXPOSE 3001

CMD ["node", "dist/server.js"]
