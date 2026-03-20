import type { FastifyInstance } from "fastify";
import { CreateDashboardSchema, UpdateDashboardSchema } from "@floorplan-ha/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/dashboards */
  app.get("/", { preHandler: [requireAuth] }, async (_request, reply) => {
    const dashboards = await prisma.dashboard.findMany({ orderBy: { createdAt: "asc" } });
    return reply.send(dashboards);
  });

  /** GET /api/dashboards/default */
  app.get("/default", { preHandler: [requireAuth] }, async (_request, reply) => {
    const dashboard = await prisma.dashboard.findFirst({ where: { isDefault: true } });
    if (!dashboard) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "No default dashboard" });
    }
    return reply.send(dashboard);
  });

  /** GET /api/dashboards/:id */
  app.get("/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const dashboard = await prisma.dashboard.findUnique({ where: { id } });
    if (!dashboard) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Dashboard not found" });
    }
    return reply.send(dashboard);
  });

  /** POST /api/dashboards */
  app.post("/", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const body = CreateDashboardSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: body.error.message });
    }

    // If setting as default, unset all others
    if (body.data.isDefault) {
      await prisma.dashboard.updateMany({ data: { isDefault: false } });
    }

    const dashboard = await prisma.dashboard.create({ data: body.data });
    return reply.status(201).send(dashboard);
  });

  /** PATCH /api/dashboards/:id */
  app.patch("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = UpdateDashboardSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: body.error.message });
    }

    const existing = await prisma.dashboard.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Dashboard not found" });
    }

    if (body.data.isDefault) {
      await prisma.dashboard.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    }

    const dashboard = await prisma.dashboard.update({ where: { id }, data: body.data });
    return reply.send(dashboard);
  });

  /** DELETE /api/dashboards/:id */
  app.delete("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.dashboard.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Dashboard not found" });
    }
    await prisma.dashboard.delete({ where: { id } });
    return reply.status(204).send();
  });
}
