import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

export async function revisionRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/revisions?entity_type=hotspot&entity_id=:id
   * Returns revision history for a given entity, newest first.
   */
  app.get("/", { preHandler: [requireAuth, requireAdmin] }, async (request, reply) => {
    const { entity_type, entity_id } = request.query as {
      entity_type?: string;
      entity_id?: string;
    };

    const revisions = await prisma.revisionHistory.findMany({
      where: {
        ...(entity_type ? { entityType: entity_type } : {}),
        ...(entity_id ? { entityId: entity_id } : {}),
      },
      include: {
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return reply.send(revisions);
  });
}
