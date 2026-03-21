import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { getHaService } from "./services/ha.js";
import { initAssetStorage } from "./services/asset-storage.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { allowedEmailRoutes } from "./routes/allowed-emails.js";
import { dashboardRoutes } from "./routes/dashboards.js";
import { floorplanRoutes } from "./routes/floorplans.js";
import { hotspotRoutes } from "./routes/hotspots.js";
import { assetRoutes } from "./routes/assets.js";
import { haRoutes } from "./routes/ha.js";
import { settingsRoutes } from "./routes/settings.js";
import { stateStreamRoutes } from "./routes/state-stream.js";
import { revisionRoutes } from "./routes/revisions.js";
import { weatherRoutes } from "./routes/weather.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
    },
    bodyLimit: 25 * 1024 * 1024, // 25 MB — must be >= multipart fileSize limit
  });

  // ─── Plugins ──────────────────────────────────────────────────────────────

  await app.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(fastifyCookie);

  await app.register(fastifyMultipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  await app.register(fastifyStatic, {
    root: env.ASSET_STORAGE_PATH,
    prefix: "/uploads/",
    decorateReply: true,
  });

  // ─── Routes ───────────────────────────────────────────────────────────────

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(userRoutes, { prefix: "/api/users" });
  await app.register(allowedEmailRoutes, { prefix: "/api/allowed-emails" });
  await app.register(dashboardRoutes, { prefix: "/api/dashboards" });
  await app.register(floorplanRoutes, { prefix: "/api/floorplans" });
  await app.register(hotspotRoutes, { prefix: "/api/hotspots" });
  await app.register(assetRoutes, { prefix: "/api/assets" });
  await app.register(haRoutes, { prefix: "/api/ha" });
  await app.register(settingsRoutes, { prefix: "/api/settings" });
  await app.register(stateStreamRoutes, { prefix: "/api/state" });
  await app.register(revisionRoutes, { prefix: "/api/revisions" });
  await app.register(weatherRoutes, { prefix: "/api/weather" });

  // ─── Health Check ─────────────────────────────────────────────────────────

  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return app;
}

async function main() {
  const app = await buildApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    await app.close();
    getHaService().disconnect();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Initialise asset storage (local filesystem; swap to S3 by replacing the implementation)
  initAssetStorage(env.ASSET_STORAGE_PATH);

  // Start HA WebSocket connection
  getHaService().connect();

  // Start HTTP server
  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  app.log.info(`API server listening on port ${env.API_PORT}`);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
