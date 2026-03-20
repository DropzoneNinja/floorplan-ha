import type { EntityState } from "@floorplan-ha/shared";
import type { HaClientConfig, HaServiceDomain, HaStateResponse } from "./types.js";
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
}
