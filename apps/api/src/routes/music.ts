import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { getMusicAssistantService, type MusicLibraryMediaType } from "../services/music-assistant.js";

const LIBRARY_MEDIA_TYPES: MusicLibraryMediaType[] = ["artist", "album", "track", "playlist", "radio", "podcast", "audiobook"];
const DEFAULT_LIMIT = 100;

const NOT_CONFIGURED = {
  statusCode: 503,
  error: "Service Unavailable",
  message: "Music Assistant direct access is not configured (MA_BASE_URL/MA_TOKEN)",
};

/**
 * Talks directly to the Music Assistant server for library browsing — see
 * MusicAssistantService for why this can't go through HA's
 * media_player/browse_media (silent truncation past ~500 items per folder,
 * no drill-down pagination at all).
 */
export async function musicRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/music/library?type=track&limit=100&offset=0 — a root category's flat item list. */
  app.get("/library", { preHandler: [requireAuth] }, async (request, reply) => {
    const { type, limit, offset } = request.query as { type?: string; limit?: string; offset?: string };
    if (!type || !LIBRARY_MEDIA_TYPES.includes(type as MusicLibraryMediaType)) {
      return reply
        .status(400)
        .send({ statusCode: 400, error: "Bad Request", message: `Query param 'type' must be one of: ${LIBRARY_MEDIA_TYPES.join(", ")}` });
    }
    const mass = getMusicAssistantService();
    if (!mass.isConfigured) return reply.status(503).send(NOT_CONFIGURED);
    try {
      const items = await mass.getLibraryItems(type as MusicLibraryMediaType, Number(limit) || DEFAULT_LIMIT, Number(offset) || 0);
      return reply.send(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/music/artist?uri=library://artist/184 — an artist's albums + tracks. */
  app.get("/artist", { preHandler: [requireAuth] }, async (request, reply) => {
    const { uri } = request.query as { uri?: string };
    if (!uri) return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query param 'uri' is required" });
    const mass = getMusicAssistantService();
    if (!mass.isConfigured) return reply.status(503).send(NOT_CONFIGURED);
    try {
      const detail = await mass.getArtistDetail(uri);
      return reply.send(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/music/album?uri=library://album/266 — an album's tracks. */
  app.get("/album", { preHandler: [requireAuth] }, async (request, reply) => {
    const { uri } = request.query as { uri?: string };
    if (!uri) return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query param 'uri' is required" });
    const mass = getMusicAssistantService();
    if (!mass.isConfigured) return reply.status(503).send(NOT_CONFIGURED);
    try {
      const tracks = await mass.getAlbumTracks(uri);
      return reply.send(tracks);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });

  /** GET /api/music/playlist?uri=library://playlist/4&limit=100&offset=0 — a playlist's tracks. */
  app.get("/playlist", { preHandler: [requireAuth] }, async (request, reply) => {
    const { uri, limit, offset } = request.query as { uri?: string; limit?: string; offset?: string };
    if (!uri) return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query param 'uri' is required" });
    const mass = getMusicAssistantService();
    if (!mass.isConfigured) return reply.status(503).send(NOT_CONFIGURED);
    try {
      const tracks = await mass.getPlaylistTracks(uri, Number(limit) || DEFAULT_LIMIT, Number(offset) || 0);
      return reply.send(tracks);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message });
    }
  });
}
