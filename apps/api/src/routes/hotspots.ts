import type { FastifyInstance } from "fastify";
import {
  CreateHotspotSchema,
  UpdateHotspotSchema,
  CreateHotspotStateRuleSchema,
} from "@floorplan-ha/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { recordRevision } from "../services/revisions.js";

export async function hotspotRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/hotspots?floorplanId= */
  app.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const { floorplanId } = request.query as { floorplanId?: string };
    const hotspots = await prisma.hotspot.findMany({
      where: floorplanId ? { floorplanId } : undefined,
      include: { stateRules: { orderBy: { priority: "asc" } } },
      orderBy: { zIndex: "asc" },
    });
    return reply.send(hotspots);
  });

  /** GET /api/hotspots/:id */
  app.get("/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const hotspot = await prisma.hotspot.findUnique({
      where: { id },
      include: { stateRules: { orderBy: { priority: "asc" } } },
    });
    if (!hotspot) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Hotspot not found" });
    }
    return reply.send(hotspot);
  });

  /** POST /api/hotspots */
  app.post("/", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const body = CreateHotspotSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: body.error.message });
    }

    const { position, config, ...rest } = body.data;
    const hotspot = await prisma.hotspot.create({
      data: {
        ...rest,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
        rotation: position.rotation,
        zIndex: position.zIndex,
        configJson: config,
      },
      include: { stateRules: true },
    });
    await recordRevision("hotspot", hotspot.id, "create", null, hotspot, request.user?.sub);
    return reply.status(201).send(hotspot);
  });

  /** PATCH /api/hotspots/:id */
  app.patch("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateHotspotSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: body.error.message });
    }

    const existing = await prisma.hotspot.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Hotspot not found" });
    }

    const { position, config, ...rest } = body.data;
    const hotspot = await prisma.hotspot.update({
      where: { id },
      data: {
        ...rest,
        ...(position
          ? {
              x: position.x ?? existing.x,
              y: position.y ?? existing.y,
              width: position.width ?? existing.width,
              height: position.height ?? existing.height,
              rotation: position.rotation ?? existing.rotation,
              zIndex: position.zIndex ?? existing.zIndex,
            }
          : {}),
        ...(config ? { configJson: config } : {}),
      },
      include: { stateRules: { orderBy: { priority: "asc" } } },
    });

    await recordRevision("hotspot", id, "update", existing, hotspot, request.user?.sub);
    return reply.send(hotspot);
  });

  /** DELETE /api/hotspots/:id */
  app.delete("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.hotspot.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Hotspot not found" });
    }
    await prisma.hotspot.delete({ where: { id } });
    await recordRevision("hotspot", id, "delete", existing, null, request.user?.sub);
    return reply.status(204).send();
  });

  /** POST /api/hotspots/:id/duplicate */
  app.post("/:id/duplicate", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const original = await prisma.hotspot.findUnique({
      where: { id },
      include: { stateRules: true },
    });
    if (!original) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Hotspot not found" });
    }

    const { id: _id, createdAt: _ca, updatedAt: _ua, stateRules, ...data } = original;
    const duplicate = await prisma.hotspot.create({
      data: {
        ...data,
        name: `${data.name} (copy)`,
        x: Math.min(data.x + 0.02, 0.98),
        y: Math.min(data.y + 0.02, 0.98),
        stateRules: {
          create: stateRules.map((rule: {
            priority: number;
            conditionType: string;
            conditionJson: unknown;
            resultJson: unknown;
          }) => ({
            priority: rule.priority,
            conditionType: rule.conditionType,
            conditionJson: rule.conditionJson,
            resultJson: rule.resultJson,
          })),
        },
      },
      include: { stateRules: { orderBy: { priority: "asc" } } },
    });
    return reply.status(201).send(duplicate);
  });

  // ─── State Rules sub-resource ─────────────────────────────────────────────

  /** GET /api/hotspots/:id/rules */
  app.get("/:id/rules", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const rules = await prisma.hotspotStateRule.findMany({
      where: { hotspotId: id },
      orderBy: { priority: "asc" },
    });
    return reply.send(rules);
  });

  /** PUT /api/hotspots/:id/rules — replace all rules */
  app.put("/:id/rules", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as { rules?: unknown })?.rules;
    const parsed = Array.isArray(body)
      ? body.map((r) => CreateHotspotStateRuleSchema.safeParse(r))
      : [];

    const failures = parsed.filter((r) => !r.success);
    if (failures.length > 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "One or more rules are invalid",
      });
    }

    await prisma.$transaction([
      prisma.hotspotStateRule.deleteMany({ where: { hotspotId: id } }),
      ...parsed
        .filter((r): r is Extract<typeof r, { success: true }> => r.success)
        .map((r) =>
          prisma.hotspotStateRule.create({
            data: {
              hotspotId: id,
              priority: r.data.priority,
              conditionType: r.data.condition.type,
              conditionJson: r.data.condition,
              resultJson: r.data.result,
            },
          }),
        ),
    ]);

    const rules = await prisma.hotspotStateRule.findMany({
      where: { hotspotId: id },
      orderBy: { priority: "asc" },
    });
    return reply.send(rules);
  });
}
