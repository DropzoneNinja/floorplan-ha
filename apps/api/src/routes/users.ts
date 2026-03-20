import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const PatchUserSchema = z.object({
  isEnabled: z.boolean().optional(),
  resetLock: z.boolean().optional(),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/users
   * List all users. Admin only.
   */
  app.get("/", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isEnabled: true,
        failedLoginAttempts: true,
        lockedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return reply.send(users);
  });

  /**
   * PATCH /api/users/:id
   * Update a user's enabled status or reset their lockout. Admin only.
   */
  app.patch("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const body = PatchUserSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: body.error.issues.map((i) => i.message).join(", "),
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "User not found" });
    }

    const data: Record<string, unknown> = {};
    if (body.data.isEnabled !== undefined) {
      data["isEnabled"] = body.data.isEnabled;
    }
    if (body.data.resetLock) {
      data["lockedAt"] = null;
      data["failedLoginAttempts"] = 0;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        isEnabled: true,
        failedLoginAttempts: true,
        lockedAt: true,
        createdAt: true,
      },
    });

    return reply.send(updated);
  });

  /**
   * DELETE /api/users/:id
   * Delete a user. Admin only. Cannot delete yourself.
   */
  app.delete("/:id", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (id === request.user!.sub) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Cannot delete your own account",
      });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "User not found" });
    }

    await prisma.user.delete({ where: { id } });
    return reply.status(204).send();
  });
}
