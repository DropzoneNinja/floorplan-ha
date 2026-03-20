import { HaRestClient, HaWebSocketClient } from "@floorplan-ha/ha-client";
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
class HaService {
  private rest: HaRestClient;
  private ws: HaWebSocketClient;
  private stateCache = new Map<string, EntityState>();
  private subscribers = new Set<StateChangeCallback>();
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
          this.hydrateCache();
          break;

        case "disconnected":
          this.connectionStatus = {
            ...this.connectionStatus,
            connected: false,
            error: event.reason,
          };
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
    this.ws.disconnect();
  }

  private async hydrateCache(): Promise<void> {
    try {
      const states = await this.rest.getStates();
      for (const s of states) {
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
