import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HaCallServiceSchema, CreateHotspotStateRuleSchema, evaluateRules } from "@floorplan-ha/shared";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getHaService } from "../services/ha.js";

export async function haRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/ha/config — Home Assistant home location (latitude, longitude) */
  app.get("/config", { preHandler: [requireAuth] }, async (_request, reply) => {
    const ha = getHaService();
    try {
      const config = await ha.getConfig();
      return reply.send({ latitude: config.latitude, longitude: config.longitude });
    } catch {
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message: "Could not reach Home Assistant" });
    }
  });

  /** GET /api/ha/status — HA connection status */
  app.get("/status", { preHandler: [requireAuth] }, async (_request, reply) => {
    const ha = getHaService();
    return reply.send(ha.getStatus());
  });

  /** GET /api/ha/entities — list all HA entities */
  app.get("/entities", { preHandler: [requireAuth] }, async (_request, reply) => {
    const ha = getHaService();
    const entities = ha.getAllStates();
    return reply.send(entities);
  });

  /** GET /api/ha/entities/:entityId — single entity state */
  app.get("/entities/:entityId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const ha = getHaService();
    const entity = ha.getState(entityId);
    if (!entity) {
      // Fall back to live fetch
      try {
        const live = await ha.fetchState(entityId);
        return reply.send(live);
      } catch {
        return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Entity not found" });
      }
    }
    return reply.send(entity);
  });

  /** GET /api/ha/services — list all HA service definitions (flattened) */
  app.get("/services", { preHandler: [requireAuth] }, async (_request, reply) => {
    const ha = getHaService();
    const domains = await ha.getServices();
    const flat = domains.flatMap((d) =>
      Object.entries(d.services).map(([svc, def]) => ({
        domain: d.domain,
        service: svc,
        description: def.description ?? "",
        fields: def.fields,
      })),
    );
    return reply.send(flat);
  });

  /** POST /api/ha/services/:domain/:service — call a HA service
   * Requires auth but NOT admin — authenticated viewers can trigger actions
   * from the presentation dashboard (e.g. toggle a light). */
  app.post(
    "/services/:domain/:service",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { domain, service } = request.params as { domain: string; service: string };
      const body = HaCallServiceSchema.safeParse(request.body ?? {});
      if (!body.success) {
        return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: body.error.message });
      }

      const ha = getHaService();
      const t = body.data.target;
      const target = t
        ? {
            ...(t.entityId !== undefined ? { entityId: t.entityId } : {}),
            ...(t.deviceId !== undefined ? { deviceId: t.deviceId } : {}),
            ...(t.areaId !== undefined ? { areaId: t.areaId } : {}),
          }
        : undefined;
      try {
        const result = await ha.callService(domain, service, body.data.serviceData, target);
        return reply.send(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
      }
    },
  );

  /** GET /api/ha/calendar/:entityId/events — upcoming calendar events
   * Query params: days (default 30) — how many days ahead to look */
  app.get("/calendar/:entityId/events", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const { days: daysStr } = (request.query as { days?: string });
    const days = Math.min(Math.max(parseInt(daysStr ?? "30", 10) || 30, 1), 365);

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    const ha = getHaService();
    try {
      const events = await ha.getCalendarEvents(entityId, start.toISOString(), end.toISOString());
      return reply.send(events);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/ha/states — all current entity states from cache */
  app.get("/states", { preHandler: [requireAuth] }, async (_request, reply) => {
    const ha = getHaService();
    return reply.send(ha.getAllStates());
  });

  /** POST /api/ha/preview-state — evaluate state rules against a given state value.
   * Pure server-side computation — used by the editor to preview rule outcomes.
   * Accepts: { state: string, rules: HotspotStateRule[] }
   * Returns: { matchedRuleIndex: number | null, result: RuleResult | null } */
  const PreviewStateSchema = z.object({
    state: z.string(),
    rules: z.array(CreateHotspotStateRuleSchema),
  });

  app.post("/preview-state", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = PreviewStateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: parsed.error.message,
      });
    }

    const { state, rules } = parsed.data;

    // Sort rules by priority to find which index matched
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    let matchedRuleIndex: number | null = null;
    const result = evaluateRules(rules, state);

    if (result !== null) {
      // Find the index of the matched rule in the original (unsorted) input array
      for (let i = 0; i < sorted.length; i++) {
        const rule = sorted[i]!;
        // Simple re-evaluation to find the match position
        const singleResult = evaluateRules([rule], state);
        if (singleResult !== null) {
          matchedRuleIndex = i;
          break;
        }
      }
    }

    return reply.send({ matchedRuleIndex, result });
  });
}
