import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";

const CFA_RSS_URL = "https://www.cfa.vic.gov.au/cfa/rssfeed/tfbfdrforecast_rss.xml";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface FirebanStatus {
  totalFireban: boolean;
  fetchedAt: string;
}

interface CacheEntry {
  data: FirebanStatus;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Parses the CFA TFB RSS feed XML text and returns true if a Total Fire Ban
 * is declared for the Central district.
 *
 * The RSS feed contains <item> elements with <title> tags. A Central district TFB
 * is indicated by items whose title contains both "Central" and "Total Fire Ban".
 */
function parseTotalFireban(xml: string): boolean {
  // Extract all <item> blocks
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const item of itemMatches) {
    // Extract the <title> content from this item
    const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!titleMatch?.[1]) continue;

    // Strip CDATA wrappers if present
    const title = titleMatch[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
      .trim();

    // Check for Central district Total Fire Ban
    if (/central/i.test(title) && /total fire ban/i.test(title)) {
      return true;
    }
  }

  return false;
}

export async function firebanRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/fireban/status
   * Returns whether a Total Fire Ban is currently declared for the CFA Central district.
   * Fetches the CFA RSS feed and caches the result for 30 minutes.
   */
  app.get("/status", { preHandler: [requireAuth] }, async (_request, reply) => {
    if (cache && isFresh(cache)) {
      return reply.send(cache.data);
    }

    let totalFireban = false;
    try {
      const res = await fetch(CFA_RSS_URL, {
        headers: { "User-Agent": "floorplan-ha/1.0" },
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        const xml = await res.text();
        totalFireban = parseTotalFireban(xml);
      } else {
        app.log.warn(`CFA RSS feed returned ${res.status} — defaulting to no fireban`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      app.log.warn(`CFA RSS fetch failed: ${message} — defaulting to no fireban`);
    }

    const data: FirebanStatus = {
      totalFireban,
      fetchedAt: new Date().toISOString(),
    };

    cache = { data, fetchedAt: Date.now() };
    return reply.send(data);
  });
}
