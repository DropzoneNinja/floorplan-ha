import type { EntityState } from "@floorplan-ha/shared";
import type { HaCalendarEvent, HaClientConfig, HaServiceDomain, HaStateResponse } from "./types.js";
import { normalizeState, normalizeStates } from "./normalizer.js";

/**
 * Typed REST client for the Home Assistant API.
 * The HA token is kept here and never exposed to callers beyond this module.
 */
export class HaRestClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(config: Pick<HaClientConfig, "baseUrl" | "token">) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api${path}`;
    const response = await fetch(url, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`HA REST ${response.status} ${response.statusText}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  /** Check if the HA API is reachable and the token is valid. */
  async ping(): Promise<boolean> {
    try {
      await this.request<{ message: string }>("/");
      return true;
    } catch {
      return false;
    }
  }

  /** Get all entity states. */
  async getStates(): Promise<EntityState[]> {
    const raw = await this.request<HaStateResponse[]>("/states");
    return normalizeStates(raw);
  }

  /** Get a single entity state by entity_id. */
  async getState(entityId: string): Promise<EntityState> {
    const raw = await this.request<HaStateResponse>(`/states/${entityId}`);
    return normalizeState(raw);
  }

  /** Get all service definitions. */
  async getServices(): Promise<HaServiceDomain[]> {
    return this.request<HaServiceDomain[]>("/services");
  }

  /** Get Home Assistant configuration (includes home latitude/longitude). */
  async getConfig(): Promise<{ latitude: number; longitude: number; [key: string]: unknown }> {
    return this.request("/config");
  }

  /** Get calendar events for a given entity within a date range (ISO 8601 strings). */
  async getCalendarEvents(entityId: string, start: string, end: string): Promise<HaCalendarEvent[]> {
    return this.request<HaCalendarEvent[]>(
      `/calendars/${entityId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
  }

  /** Get historical state readings for an entity within a day (ISO 8601 start/end strings). */
  async getHistory(entityId: string, start: string, end: string): Promise<Array<{ state: string; last_changed: string }>> {
    const params = new URLSearchParams({
      filter_entity_id: entityId,
      end_time: end,
      minimal_response: "true",
      no_attributes: "true",
    });
    const raw = await this.request<Array<Array<{ state: string; last_changed: string }>>>(
      `/history/period/${encodeURIComponent(start)}?${params}`,
    );
    return raw[0] ?? [];
  }

  /**
   * Fetch a binary resource from an HA-relative path (e.g. an entity's
   * `entity_picture` attribute, which is a self-authenticating signed path
   * like "/api/media_player_proxy/media_player.x?token=..."). Returns null
   * if HA responds with a non-2xx status.
   */
  async fetchRelativeImage(relativePath: string): Promise<{ body: Buffer; contentType: string } | null> {
    const url = `${this.baseUrl}${relativePath}`;
    const response = await fetch(url, { headers: this.headers });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    return { body: Buffer.from(arrayBuffer), contentType };
  }

  /** Call a Home Assistant service. */
  async callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entity_id?: string; device_id?: string; area_id?: string },
  ): Promise<HaStateResponse[]> {
    return this.request<HaStateResponse[]>(`/services/${domain}/${service}`, {
      method: "POST",
      body: JSON.stringify({
        ...serviceData,
        ...(target?.entity_id !== undefined ? { entity_id: target.entity_id } : {}),
        ...(target?.device_id !== undefined ? { device_id: target.device_id } : {}),
        ...(target?.area_id !== undefined ? { area_id: target.area_id } : {}),
      }),
    });
  }

  /**
   * Call a response-capable Home Assistant service (e.g. `media_player.browse_media`,
   * `music_assistant.search`) and return its `service_response` payload. HA only
   * includes response data when the request is made with `?return_response`.
   */
  async callServiceWithResponse<T = unknown>(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entity_id?: string; device_id?: string; area_id?: string },
  ): Promise<T> {
    const result = await this.request<{ changed_states: HaStateResponse[]; service_response?: T }>(
      `/services/${domain}/${service}?return_response`,
      {
        method: "POST",
        body: JSON.stringify({
          ...serviceData,
          ...(target?.entity_id !== undefined ? { entity_id: target.entity_id } : {}),
          ...(target?.device_id !== undefined ? { device_id: target.device_id } : {}),
          ...(target?.area_id !== undefined ? { area_id: target.area_id } : {}),
        }),
      },
    );
    return (result.service_response ?? {}) as T;
  }

  /** List HA config entries, optionally filtered to one integration domain (e.g. "music_assistant"). */
  async getConfigEntries(domain?: string): Promise<Array<{ entry_id: string; domain: string; title: string }>> {
    const all = await this.request<Array<{ entry_id: string; domain: string; title: string }>>(
      "/config/config_entries/entry",
    );
    return domain ? all.filter((e) => e.domain === domain) : all;
  }

  /**
   * Fetch an image from an arbitrary absolute URL (e.g. Music Assistant's own
   * thumbnail server on the LAN) — never sends the HA bearer token, since this
   * request may not be going to HA at all. Returns null on any non-2xx response
   * or network failure so callers can fall back to a placeholder.
   */
  async fetchAbsoluteImage(url: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();
      return { body: Buffer.from(arrayBuffer), contentType };
    } catch {
      return null;
    }
  }
}
