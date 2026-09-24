import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HaCallServiceSchema, CreateHotspotStateRuleSchema, evaluateRules } from "@floorplan-ha/shared";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getHaService } from "../services/ha.js";
import { getMusicAssistantService } from "../services/music-assistant.js";

const QUEUE_ITEMS_LIMIT = 50;

/** Resolves a player's HA entity_id to its Music Assistant queue_id (the two
 * are the same value — see HaService.getQueue) so queue-item mutations,
 * which only MA's own API supports, know which queue to act on. */
async function resolveQueueId(entityId: string): Promise<string | null> {
  const result = await getHaService().getQueue(entityId);
  const summary = result as { queue_id?: string } | null;
  return summary?.queue_id ?? null;
}

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

  /** GET /api/ha/statistics/:entityId?start=ISO&end=ISO&period=month&types=max,min — long-term statistics (survives history purge) */
  app.get("/statistics/:entityId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const { start, end, period = "month", types = "max" } = request.query as { start?: string; end?: string; period?: string; types?: string };

    if (!start || !end) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query params 'start' and 'end' are required (ISO 8601)" });
    }
    const validPeriods = ["5minute", "hour", "day", "week", "month"] as const;
    type ValidPeriod = typeof validPeriods[number];
    if (!validPeriods.includes(period as ValidPeriod)) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "period must be one of: 5minute, hour, day, week, month" });
    }
    const validTypes = ["max", "min", "mean", "sum", "state", "change"] as const;
    type ValidType = typeof validTypes[number];
    const typeList = types.split(",").map((t) => t.trim()) as ValidType[];
    if (typeList.some((t) => !validTypes.includes(t))) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "types must be a comma-separated list of: max, min, mean, sum, state, change" });
    }

    const ha = getHaService();
    try {
      const stats = await ha.getStatisticsDuringPeriod(entityId, start, end, period as ValidPeriod, typeList);
      return reply.send({ statistics: stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/ha/history-range/:entityId?start=YYYY-MM-DD&end=YYYY-MM-DD — readings over a date range */
  app.get("/history-range/:entityId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const { start, end } = request.query as { start?: string; end?: string };

    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query params 'start' and 'end' must be YYYY-MM-DD" });
    }

    const ha = getHaService();
    try {
      const raw = await ha.getHistory(entityId, `${start}T00:00:00`, `${end}T23:59:59`);
      const readings = raw
        .filter((r) => !isNaN(parseFloat(r.state)))
        .map((r) => ({ time: r.last_changed, value: parseFloat(r.state) }));
      return reply.send({ readings });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/ha/history/:entityId?date=YYYY-MM-DD — historical numeric readings for one day */
  app.get("/history/:entityId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const { date } = request.query as { date?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query param 'date' must be YYYY-MM-DD" });
    }

    const start = `${date}T00:00:00`;
    const end = `${date}T23:59:59`;

    const ha = getHaService();
    try {
      const raw = await ha.getHistory(entityId, start, end);
      const readings = raw
        .filter((r) => !isNaN(parseFloat(r.state)))
        .map((r) => ({ time: r.last_changed, value: parseFloat(r.state) }));
      return reply.send({ readings });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/ha/media-image/:entityId — proxies a media entity's picture (e.g. album art).
   * Required because entity_picture is an HA-relative path the browser can never resolve
   * directly under this app's "browser never talks to HA" security model. */
  app.get("/media-image/:entityId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const ha = getHaService();
    try {
      const image = await ha.getMediaImage(entityId);
      if (!image) {
        return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "No picture available for this entity" });
      }
      return reply.type(image.contentType).send(image.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/ha/media/browse?entityId=&mediaContentType=&mediaContentId= — browse a
   * media_player's source tree (e.g. Music Assistant library). Omit mediaContentType/Id
   * for the root node. */
  app.get("/media/browse", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId, mediaContentType, mediaContentId } = request.query as {
      entityId?: string;
      mediaContentType?: string;
      mediaContentId?: string;
    };
    if (!entityId) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query param 'entityId' is required" });
    }
    const ha = getHaService();
    try {
      const result = await ha.browseMedia(entityId, mediaContentType, mediaContentId);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /**
   * GET /api/ha/media/queue/:entityId — a player's Music Assistant queue summary
   * (current/next track, shuffle/repeat, etc, via HA), plus — when MA_BASE_URL/
   * MA_TOKEN are configured — up to 50 upcoming queue items fetched directly from
   * the Music Assistant server, since HA's get_queue service has no items list.
   */
  app.get("/media/queue/:entityId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId } = request.params as { entityId: string };
    const ha = getHaService();
    try {
      const result = await ha.getQueue(entityId);
      const summary = result as { queue_id?: string; current_index?: number | null } | null;
      const mass = getMusicAssistantService();
      if (summary?.queue_id && mass.isConfigured) {
        try {
          const items = await mass.getQueueItems(summary.queue_id, QUEUE_ITEMS_LIMIT, summary.current_index ?? 0);
          (result as Record<string, unknown>).queue_items = items;
        } catch (err) {
          request.log.warn({ err }, "Failed to fetch full Music Assistant queue items");
        }
      }
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** POST /api/ha/media/queue/:entityId/items/:queueItemId/move — reorder a queue item.
   * Body: { posShift: number } — relative shift (positive = later, negative = earlier).
   * MA rejects moving the currently playing item (index 0); the frontend disables that gesture there. */
  app.post("/media/queue/:entityId/items/:queueItemId/move", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId, queueItemId } = request.params as { entityId: string; queueItemId: string };
    const { posShift } = (request.body ?? {}) as { posShift?: number };
    if (typeof posShift !== "number" || !Number.isInteger(posShift) || posShift === 0) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Body 'posShift' must be a non-zero integer" });
    }
    const mass = getMusicAssistantService();
    if (!mass.isConfigured) {
      return reply
        .status(503)
        .send({ statusCode: 503, error: "Service Unavailable", message: "Music Assistant direct access is not configured (MA_BASE_URL/MA_TOKEN)" });
    }
    try {
      const queueId = await resolveQueueId(entityId);
      if (!queueId) return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "No active queue on this player" });
      await mass.moveQueueItem(queueId, queueItemId, posShift);
      return reply.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** DELETE /api/ha/media/queue/:entityId/items/:queueItemId — remove an item from the queue. */
  app.delete("/media/queue/:entityId/items/:queueItemId", { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityId, queueItemId } = request.params as { entityId: string; queueItemId: string };
    const mass = getMusicAssistantService();
    if (!mass.isConfigured) {
      return reply
        .status(503)
        .send({ statusCode: 503, error: "Service Unavailable", message: "Music Assistant direct access is not configured (MA_BASE_URL/MA_TOKEN)" });
    }
    try {
      const queueId = await resolveQueueId(entityId);
      if (!queueId) return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "No active queue on this player" });
      await mass.removeQueueItem(queueId, queueItemId);
      return reply.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/ha/media/search?q= — search the Music Assistant library */
  app.get("/media/search", { preHandler: [requireAuth] }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || !q.trim()) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query param 'q' is required" });
    }
    const ha = getHaService();
    try {
      const result = await ha.searchMedia(q);
      return reply.send(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/ha/media/image-proxy?url= — proxies an absolute image URL (e.g. Music
   * Assistant's own thumbnail server), never HA itself. See HaService.proxyExternalImage. */
  app.get("/media/image-proxy", { preHandler: [requireAuth] }, async (request, reply) => {
    const { url } = request.query as { url?: string };
    if (!url) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query param 'url' is required" });
    }
    const ha = getHaService();
    try {
      const image = await ha.proxyExternalImage(url);
      if (!image) {
        return reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Image not available" });
      }
      return reply.type(image.contentType).send(image.body);
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
