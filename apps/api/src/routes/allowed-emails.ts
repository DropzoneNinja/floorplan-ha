import type { FastifyInstance } from "fastify";
import { CreateAllowedEmailSchema } from "@floorplan-ha/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export async function allowedEmailRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/allowed-emails
   * List all pre-authorized emails. Admin only.
   */
  app.get("/", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const entries = await prisma.allowedEmail.findMany({
      orderBy: { createdAt: "asc" },
    });
    return reply.send(entries);
  });

  /**
   * POST /api/allowed-emails
   * Add an email to the whitelist. Admin only.
   */
  app.post("/", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const body = CreateAllowedEmailSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join(", "),
      });
    }

    const existing = await prisma.allowedEmail.findUnique({ where: { email: body.data.email } });
    if (existing) {
      return reply.status(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "This email is already on the allowed list",
      });
    }

    const entry = await prisma.allowedEmail.create({
      data: { email: body.data.email, role: body.data.role },
    });

    return reply.status(201).send(entry);
  });

  /**
   * DELETE /api/allowed-emails/:id
   * Remove an email from the whitelist. Admin only.
   */
  app.delete("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const entry = await prisma.allowedEmail.findUnique({ where: { id } });
    if (!entry) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Entry not found" });
    }

    await prisma.allowedEmail.delete({ where: { id } });
    return reply.status(204).send();
  });
}
