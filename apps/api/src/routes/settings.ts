import type { FastifyInstance } from "fastify";
import { UpdateSettingSchema } from "@floorplan-ha/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { settingsBus } from "../services/settings-bus.js";

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/settings */
  app.get("/", { preHandler: [requireAuth] }, async (_request, reply) => {
    const settings = await prisma.appSetting.findMany();
    // Convert to key→value map for convenience
    const map = Object.fromEntries(settings.map((s: { key: string; valueJson: unknown }) => [s.key, s.valueJson]));
    return reply.send(map);
  });

  /** PUT /api/settings/:key */
  app.put("/:key", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { key } = request.params as { key: string };
    const body = UpdateSettingSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: body.error.message });
    }

    // JSON round-trip converts unknown → any, which satisfies Prisma's InputJsonValue
    const value = JSON.parse(JSON.stringify(body.data.value));
    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: { valueJson: value },
      create: { key, valueJson: value },
    });
    settingsBus.emit(key);
    return reply.send(setting);
  });
}
