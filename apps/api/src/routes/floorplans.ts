import type { FastifyInstance } from "fastify";
import { CreateFloorplanSchema, UpdateFloorplanSchema } from "@floorplan-ha/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { recordRevision } from "../services/revisions.js";

export async function floorplanRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/floorplans?dashboardId= */
  app.get("/", { preHandler: [requireAuth] }, async (request, reply) => {
    const { dashboardId } = request.query as { dashboardId?: string };
    const floorplans = await prisma.floorplan.findMany({
      where: dashboardId ? { dashboardId } : undefined,
      orderBy: { createdAt: "asc" },
    });
    return reply.send(floorplans);
  });

  /** GET /api/floorplans/:id — includes hotspots and state rules */
  app.get("/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const floorplan = await prisma.floorplan.findUnique({
      where: { id },
      include: {
        hotspots: {
          include: { stateRules: { orderBy: { priority: "asc" } } },
          orderBy: { zIndex: "asc" },
        },
      },
    });
    if (!floorplan) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Floorplan not found" });
    }
    return reply.send(floorplan);
  });

  /** POST /api/floorplans */
  app.post("/", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const body = CreateFloorplanSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: body.error.message });
    }

    const floorplan = await prisma.floorplan.create({ data: body.data });
    await recordRevision("floorplan", floorplan.id, "create", null, floorplan, request.user?.sub);
    return reply.status(201).send(floorplan);
  });

  /** PATCH /api/floorplans/:id */
  app.patch("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateFloorplanSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: body.error.message });
    }

    const existing = await prisma.floorplan.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Floorplan not found" });
    }

    const floorplan = await prisma.floorplan.update({ where: { id }, data: body.data });
    await recordRevision("floorplan", id, "update", existing, floorplan, request.user?.sub);
    return reply.send(floorplan);
  });

  /** DELETE /api/floorplans/:id */
  app.delete("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.floorplan.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Floorplan not found" });
    }
    await prisma.floorplan.delete({ where: { id } });
    await recordRevision("floorplan", id, "delete", existing, null, request.user?.sub);
    return reply.status(204).send();
  });

  /**
   * GET /api/floorplans/:id/export
   * Export a floorplan with all its hotspots and state rules as a JSON bundle.
   */
  app.get("/:id/export", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const floorplan = await prisma.floorplan.findUnique({
      where: { id },
      include: {
        hotspots: {
          include: { stateRules: { orderBy: { priority: "asc" } } },
          orderBy: { zIndex: "asc" },
        },
      },
    });
    if (!floorplan) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Floorplan not found" });
    }

    const bundle = {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      floorplan: {
        name: floorplan.name,
        width: floorplan.width,
        height: floorplan.height,
        backgroundColor: floorplan.backgroundColor,
        imageAssetId: floorplan.imageAssetId,
      },
      hotspots: floorplan.hotspots.map((h: {
        name: string; type: string; x: number; y: number; width: number; height: number;
        rotation: number; zIndex: number; entityId: string | null; configJson: unknown;
        stateRules: Array<{ priority: number; conditionType: string; conditionJson: unknown; resultJson: unknown }>;
      }) => ({
        name: h.name,
        type: h.type,
        x: h.x,
        y: h.y,
        width: h.width,
        height: h.height,
        rotation: h.rotation,
        zIndex: h.zIndex,
        entityId: h.entityId,
        configJson: h.configJson,
        stateRules: h.stateRules.map((r) => ({
          priority: r.priority,
          conditionType: r.conditionType,
          conditionJson: r.conditionJson,
          resultJson: r.resultJson,
        })),
      })),
    };

    return reply
      .header("Content-Disposition", `attachment; filename="floorplan-${id}.json"`)
      .send(bundle);
  });

  /**
   * POST /api/floorplans/import
   * Import a floorplan bundle into a given dashboard.
   * Body: { dashboardId: string, bundle: <export bundle> }
   */
  app.post("/import", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const body = request.body as {
      dashboardId?: string;
      bundle?: {
        exportVersion?: number;
        floorplan?: {
          name?: string;
          width?: number;
          height?: number;
          backgroundColor?: string;
          imageAssetId?: string | null;
        };
        hotspots?: Array<{
          name?: string;
          type?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          rotation?: number;
          zIndex?: number;
          entityId?: string | null;
          configJson?: unknown;
          stateRules?: Array<{
            priority?: number;
            conditionType?: string;
            conditionJson?: unknown;
            resultJson?: unknown;
          }>;
        }>;
      };
    };

    if (!body?.dashboardId || !body?.bundle?.floorplan) {
      return reply
        .status(400)
        .send({ statusCode: 400, error: "Bad Request", message: "dashboardId and bundle are required" });
    }

    const { dashboardId, bundle } = body;
    const fp = bundle.floorplan!;

    // Validate dashboard exists
    const dashboard = await prisma.dashboard.findUnique({ where: { id: dashboardId } });
    if (!dashboard) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Dashboard not found" });
    }

    // Create the floorplan
    const floorplan = await prisma.floorplan.create({
      data: {
        dashboardId,
        name: fp.name ?? "Imported Floorplan",
        width: fp.width ?? 1920,
        height: fp.height ?? 1080,
        backgroundColor: fp.backgroundColor ?? "#1a1a1a",
        imageAssetId: fp.imageAssetId ?? null,
      },
    });

    // Create hotspots and their rules
    for (const h of bundle.hotspots ?? []) {
      const hotspot = await prisma.hotspot.create({
        data: {
          floorplanId: floorplan.id,
          name: h.name ?? "Imported Hotspot",
          type: (h.type as string) ?? "action",
          x: h.x ?? 0.4,
          y: h.y ?? 0.4,
          width: h.width ?? 0.1,
          height: h.height ?? 0.08,
          rotation: h.rotation ?? 0,
          zIndex: h.zIndex ?? 1,
          entityId: h.entityId ?? null,
          configJson: (h.configJson as object) ?? {},
        },
      });

      if (h.stateRules && h.stateRules.length > 0) {
        await prisma.hotspotStateRule.createMany({
          data: h.stateRules.map((r, i) => ({
            hotspotId: hotspot.id,
            priority: r.priority ?? i + 1,
            conditionType: r.conditionType ?? "fallback",
            conditionJson: (r.conditionJson as object) ?? {},
            resultJson: (r.resultJson as object) ?? {},
          })),
        });
      }
    }

    await recordRevision("floorplan", floorplan.id, "create", null, floorplan, request.user?.sub);

    const result = await prisma.floorplan.findUnique({
      where: { id: floorplan.id },
      include: {
        hotspots: {
          include: { stateRules: { orderBy: { priority: "asc" } } },
          orderBy: { zIndex: "asc" },
        },
      },
    });

    return reply.status(201).send(result);
  });
}
