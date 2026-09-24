import { HaRestClient, HaWebSocketClient } from "@floorplan-ha/ha-client";
import type { HaCalendarEvent } from "@floorplan-ha/ha-client";
import type { EntityState, HaConnectionStatus } from "@floorplan-ha/shared";
import { env } from "../lib/env.js";

type StateChangeCallback = (entityState: EntityState) => void;

/**
 * Singleton Home Assistant service layer.
 *
 * Manages:
 * - REST client for state fetches and service calls
 * - WebSocket client for real-time state change events
 * - In-memory entity state cache
 * - State change subscriber callbacks (used by the SSE route)
 */
const PERIODIC_HYDRATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class HaService {
  private rest: HaRestClient;
  private ws: HaWebSocketClient;
  private stateCache = new Map<string, EntityState>();
  private subscribers = new Set<StateChangeCallback>();
  private hydrationTimer: ReturnType<typeof setInterval> | null = null;
  private connectionStatus: HaConnectionStatus = {
    connected: false,
    lastConnectedAt: null,
    error: null,
  };

  constructor() {
    const config = { baseUrl: env.HA_BASE_URL, token: env.HA_TOKEN };
    this.rest = new HaRestClient(config);
    this.ws = new HaWebSocketClient(config);

    this.ws.on((event) => {
      switch (event.type) {
        case "connected":
          this.connectionStatus = {
            connected: true,
            lastConnectedAt: new Date().toISOString(),
            error: null,
          };
          // Hydrate cache with latest states on connect/reconnect
          void this.hydrateCache(false);
          this.startPeriodicHydration();
          break;

        case "disconnected":
          this.connectionStatus = {
            ...this.connectionStatus,
            connected: false,
            error: event.reason,
          };
          this.stopPeriodicHydration();
          break;

        case "state_changed":
          this.stateCache.set(event.entityState.entityId, event.entityState);
          for (const cb of this.subscribers) {
            cb(event.entityState);
          }
          break;

        case "error":
          console.error("[ha-service] WebSocket error:", event.error.message);
          break;
      }
    });
  }

  /** Start the WebSocket connection. Called once at server startup. */
  connect(): void {
    this.ws.connect();
  }

  /** Gracefully disconnect. Called on server shutdown. */
  disconnect(): void {
    this.stopPeriodicHydration();
    this.ws.disconnect();
  }

  private startPeriodicHydration(): void {
    this.stopPeriodicHydration();
    this.hydrationTimer = setInterval(() => {
      void this.hydrateCache(true);
    }, PERIODIC_HYDRATION_INTERVAL_MS);
  }

  private stopPeriodicHydration(): void {
    if (this.hydrationTimer) {
      clearInterval(this.hydrationTimer);
      this.hydrationTimer = null;
    }
  }

  /**
   * Fetch all entity states from HA REST and update the cache.
   * When notify=true, push any changed states to SSE subscribers so
   * connected clients receive corrections without waiting for a reconnect.
   */
  private async hydrateCache(notify: boolean): Promise<void> {
    try {
      const states = await this.rest.getStates();
      for (const s of states) {
        if (notify) {
          const cached = this.stateCache.get(s.entityId);
          if (!cached || cached.state !== s.state) {
            this.stateCache.set(s.entityId, s);
            for (const cb of this.subscribers) {
              cb(s);
            }
            continue;
          }
        }
        this.stateCache.set(s.entityId, s);
      }
      console.log(`[ha-service] Hydrated ${states.length} entity states`);
    } catch (err) {
      console.error("[ha-service] Failed to hydrate state cache:", err);
    }
  }

  /** Subscribe to real-time state change events. Returns an unsubscribe fn. */
  onStateChange(cb: StateChangeCallback): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  getStatus(): HaConnectionStatus {
    return this.connectionStatus;
  }

  getAllStates(): EntityState[] {
    return Array.from(this.stateCache.values());
  }

  getState(entityId: string): EntityState | undefined {
    return this.stateCache.get(entityId);
  }

  async fetchState(entityId: string): Promise<EntityState> {
    return this.rest.getState(entityId);
  }

  async getServices() {
    return this.rest.getServices();
  }

  async getConfig(): Promise<{ latitude: number; longitude: number }> {
    return this.rest.getConfig();
  }

  async getCalendarEvents(entityId: string, start: string, end: string): Promise<HaCalendarEvent[]> {
    return this.rest.getCalendarEvents(entityId, start, end);
  }

  async getHistory(entityId: string, start: string, end: string): Promise<Array<{ state: string; last_changed: string }>> {
    return this.rest.getHistory(entityId, start, end);
  }

  getStatisticsDuringPeriod(
    entityId: string,
    startTime: string,
    endTime: string,
    period: "5minute" | "hour" | "day" | "week" | "month",
    types: Array<"max" | "min" | "mean" | "sum" | "state" | "change">,
  ) {
    // statistics_during_period is WS-only in HA — no REST equivalent
    return this.ws.getStatisticsDuringPeriod(entityId, startTime, endTime, period, types);
  }

  /**
   * Proxy a media entity's picture (e.g. album art) through the backend.
   * `entity_picture` is an HA-relative, self-authenticating path — the
   * browser can never resolve it directly since it never talks to HA.
   * Returns null if the entity has no picture right now.
   */
  async getMediaImage(entityId: string): Promise<{ body: Buffer; contentType: string } | null> {
    const state = this.stateCache.get(entityId);
    const picturePath = state?.attributes?.entity_picture;
    if (typeof picturePath !== "string" || !picturePath) return null;
    // Native HA integrations report entity_picture as an HA-relative, self-authenticating
    // path (e.g. "/api/media_player_proxy/..."), but Music Assistant reports its own
    // absolute URL on its own LAN host instead (e.g. "http://10.x.x.x:8095/imageproxy/...").
    // Sending the latter to fetchRelativeImage would prepend HA_BASE_URL onto an already-
    // absolute URL and silently produce a broken image — dispatch on which shape it is.
    if (picturePath.startsWith("http://") || picturePath.startsWith("https://")) {
      return this.rest.fetchAbsoluteImage(picturePath);
    }
    return this.rest.fetchRelativeImage(picturePath);
  }

  /**
   * Proxy an arbitrary absolute image URL — used for Music Assistant's own
   * thumbnail images (served from its own LAN host, not HA), which the
   * browser may not be able to reach directly depending on network/deployment
   * topology. Deliberately light validation matching this app's "trusted
   * local network, authenticated users only" threat model (see SECURITY.md):
   * only http(s) URLs are allowed, and the cloud metadata endpoint is
   * blocked outright since there's no legitimate reason to ever proxy it.
   */
  async proxyExternalImage(url: string): Promise<{ body: Buffer; contentType: string } | null> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.hostname === "169.254.169.254") return null;
    return this.rest.fetchAbsoluteImage(url);
  }

  private musicAssistantConfigEntryId: string | null = null;

  private async getMusicAssistantConfigEntryId(): Promise<string | null> {
    if (this.musicAssistantConfigEntryId) return this.musicAssistantConfigEntryId;
    const entries = await this.rest.getConfigEntries("music_assistant");
    this.musicAssistantConfigEntryId = entries[0]?.entry_id ?? null;
    return this.musicAssistantConfigEntryId;
  }

  /** Browse a media_player's media source tree (Music Assistant library, playlists, etc). */
  async browseMedia(entityId: string, mediaContentType?: string, mediaContentId?: string): Promise<unknown> {
    const response = await this.rest.callServiceWithResponse<Record<string, unknown>>(
      "media_player",
      "browse_media",
      {
        ...(mediaContentType !== undefined ? { media_content_type: mediaContentType } : {}),
        ...(mediaContentId !== undefined ? { media_content_id: mediaContentId } : {}),
      },
      { entity_id: entityId },
    );
    const node = response[entityId] as { children?: Array<{ media_content_type?: string }> } | undefined;

    // At the root only, HA mixes Music Assistant's own categories (Artists, Albums,
    // Tracks, Playlists, Radio stations, Podcasts, Audiobooks — media_content_type
    // "music_assistant") in with unrelated media-source integrations also registered
    // on this HA instance (Camera, AI generated images, etc — media_content_type
    // "app"). Deeper levels don't have this problem (their children report other
    // types, e.g. "music", that must not be filtered), so this only touches the root.
    const isRoot = mediaContentType === undefined && mediaContentId === undefined;
    if (isRoot && node?.children) {
      node.children = node.children.filter((child) => child.media_content_type === "music_assistant");
    }
    return node ?? null;
  }

  /** Current + next track summary for a player's Music Assistant queue. */
  async getQueue(entityId: string): Promise<unknown> {
    const response = await this.rest.callServiceWithResponse<Record<string, unknown>>(
      "music_assistant",
      "get_queue",
      {},
      { entity_id: entityId },
    );
    return response[entityId] ?? null;
  }

  /** Search the Music Assistant library across artists/albums/tracks/playlists/radio/etc. */
  async searchMedia(query: string): Promise<unknown> {
    const configEntryId = await this.getMusicAssistantConfigEntryId();
    if (!configEntryId) {
      throw new Error("Music Assistant integration not found on this Home Assistant instance");
    }
    return this.rest.callServiceWithResponse("music_assistant", "search", {
      config_entry_id: configEntryId,
      name: query,
      // Defaults to 5 results per category when omitted — the UI already
      // caps display at 8 per category, so 25 gives it real results to trim
      // from instead of silently starving categories with more matches.
      // Flat field despite the service descriptor nesting it under
      // "search_options" for UI grouping — confirmed live (nested = 400).
      limit: 25,
    });
  }

  async callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entityId?: string; deviceId?: string; areaId?: string },
  ) {
    const haTarget = target
      ? {
          ...(target.entityId !== undefined ? { entity_id: target.entityId } : {}),
          ...(target.deviceId !== undefined ? { device_id: target.deviceId } : {}),
          ...(target.areaId !== undefined ? { area_id: target.areaId } : {}),
        }
      : undefined;
    return this.rest.callService(domain, service, serviceData, haTarget);
  }
}

// Module-level singleton
let instance: HaService | null = null;

export function getHaService(): HaService {
  if (!instance) {
    instance = new HaService();
  }
  return instance;
}
