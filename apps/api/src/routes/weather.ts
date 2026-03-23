import type { FastifyInstance } from "fastify";
import { requireAuth } from "../middleware/auth.js";
import { getHaService } from "../services/ha.js";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const DAILY_CACHE_TTL_MS = 30 * 60 * 1000;   // 30 minutes
const HOURLY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (past dates never change)

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// Module-level in-memory cache shared across all requests
const dailyCache: { entry: CacheEntry<unknown> | null } = { entry: null };
const hourlyCache = new Map<string, CacheEntry<unknown>>();

function isFresh(entry: CacheEntry<unknown>, ttlMs: number): boolean {
  return Date.now() - entry.fetchedAt < ttlMs;
}


export async function weatherRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/weather/forecast
   * Returns current conditions + 6-day daily forecast from Open-Meteo.
   * Location is sourced from Home Assistant config (latitude/longitude).
   * Cached server-side for 30 minutes.
   */
  app.get("/forecast", { preHandler: [requireAuth] }, async (_request, reply) => {
    if (dailyCache.entry && isFresh(dailyCache.entry, DAILY_CACHE_TTL_MS)) {
      return reply.send(dailyCache.entry.data);
    }

    const ha = getHaService();
    let latitude: number;
    let longitude: number;
    try {
      const haConfig = await ha.getConfig();
      latitude = haConfig.latitude;
      longitude = haConfig.longitude;
    } catch {
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message: "Could not retrieve location from Home Assistant" });
    }

    const url = new URL(OPEN_METEO_BASE);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("current_weather", "true");
    url.searchParams.set("daily", "weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("forecast_days", "6");

    let data: unknown;
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Open-Meteo returned ${res.status}`);
      }
      data = await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message: `Weather fetch failed: ${message}` });
    }

    dailyCache.entry = { data, fetchedAt: Date.now() };
    return reply.send(data);
  });

  /**
   * GET /api/weather/forecast/hourly?date=YYYY-MM-DD
   * Returns full 24-hour hourly forecast for a single date.
   * Cached per-date server-side for 24 hours.
   */
  app.get("/forecast/hourly", { preHandler: [requireAuth] }, async (request, reply) => {
    const { date } = request.query as { date?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Query param `date` must be in YYYY-MM-DD format" });
    }

    const cached = hourlyCache.get(date);
    if (cached && isFresh(cached, HOURLY_CACHE_TTL_MS)) {
      return reply.send(cached.data);
    }

    const ha = getHaService();
    let latitude: number;
    let longitude: number;
    try {
      const haConfig = await ha.getConfig();
      latitude = haConfig.latitude;
      longitude = haConfig.longitude;
    } catch {
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message: "Could not retrieve location from Home Assistant" });
    }

    const url = new URL(OPEN_METEO_BASE);
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("hourly", "temperature_2m,weathercode,precipitation_probability,windspeed_10m");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("start_date", date);
    url.searchParams.set("end_date", date);

    let rawData: { hourly?: { time?: string[]; temperature_2m?: number[]; weathercode?: number[]; precipitation_probability?: number[]; windspeed_10m?: number[] } };
    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`Open-Meteo returned ${res.status}`);
      }
      rawData = await res.json() as typeof rawData;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return reply.status(502).send({ statusCode: 502, error: "Bad Gateway", message: `Weather fetch failed: ${message}` });
    }

    const hourly = rawData.hourly ?? {};
    const data = {
      date,
      hourly: {
        time: hourly.time ?? [],
        temperature_2m: hourly.temperature_2m ?? [],
        weathercode: hourly.weathercode ?? [],
        precipitation_probability: hourly.precipitation_probability ?? [],
        windspeed_10m: hourly.windspeed_10m ?? [],
      },
    };
    hourlyCache.set(date, { data, fetchedAt: Date.now() });
    return reply.send(data);
  });
}
