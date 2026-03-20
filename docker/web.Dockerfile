FROM node:22-alpine AS base
WORKDIR /app
RUN npm install -g npm@latest

# ─── Install dependencies ─────────────────────────────────────
FROM base AS deps
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm install --workspaces --include-workspace-root

# ─── Build ────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
# Build shared first, then web
RUN npm run build -w packages/shared
RUN npm run build -w apps/web

# ─── Serve with nginx ─────────────────────────────────────────
FROM nginx:alpine AS runner
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
