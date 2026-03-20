import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { getHaService } from "../services/ha.js";

/**
 * GET /api/state/stream
 *
 * Server-Sent Events (SSE) stream that pushes entity state changes
 * to connected frontend clients in real time.
 *
 * Event format:
 *   event: state_changed
 *   data: {"entityId":"light.kitchen","state":"on",...}
 */
export async function stateStreamRoutes(app: FastifyInstance): Promise<void> {
  app.get("/stream", { preHandler: [requireAuth] }, async (request, reply) => {
    const ha = getHaService();

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send initial connection event with full state snapshot
    const allStates = ha.getAllStates();
    reply.raw.write(
      `event: init\ndata: ${JSON.stringify({ states: allStates, connected: ha.getStatus().connected })}\n\n`,
    );

    // Subscribe to ongoing state changes
    const unsubscribe = ha.onStateChange((entityState) => {
      reply.raw.write(`event: state_changed\ndata: ${JSON.stringify(entityState)}\n\n`);
    });

    // Send a heartbeat every 30s to keep the connection alive through proxies
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 30000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    // Keep the reply open
    await new Promise<void>((resolve) => {
      request.raw.on("close", resolve);
    });
  });
}
