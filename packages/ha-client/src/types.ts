import type { EntityState } from "@floorplan-ha/shared";

// ─── HA API Response Types ────────────────────────────────────────────────────

export interface HaStateResponse {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface HaServiceDomain {
  domain: string;
  services: Record<string, HaServiceDefinition>;
}

export interface HaServiceDefinition {
  name: string;
  description: string;
  fields: Record<string, HaServiceField>;
  target?: {
    entity?: { domain?: string[] };
  };
}

export interface HaServiceField {
  name?: string;
  description?: string;
  required?: boolean;
  example?: unknown;
  selector?: Record<string, unknown>;
}

// ─── WebSocket Message Types ──────────────────────────────────────────────────

export interface HaWsAuthRequired {
  type: "auth_required";
  ha_version: string;
}

export interface HaWsAuthOk {
  type: "auth_ok";
  ha_version: string;
}

export interface HaWsAuthInvalid {
  type: "auth_invalid";
  message: string;
}

export interface HaWsResult {
  id: number;
  type: "result";
  success: boolean;
  result: unknown;
  error?: { code: string; message: string };
}

export interface HaWsEvent {
  id: number;
  type: "event";
  event: {
    event_type: string;
    data: HaStateChangedEventData | Record<string, unknown>;
    origin: string;
    time_fired: string;
  };
}

export interface HaStateChangedEventData {
  entity_id: string;
  old_state: HaStateResponse | null;
  new_state: HaStateResponse | null;
}

export interface HaWsPong {
  id: number;
  type: "pong";
}

export type HaWsMessage =
  | HaWsAuthRequired
  | HaWsAuthOk
  | HaWsAuthInvalid
  | HaWsResult
  | HaWsEvent
  | HaWsPong;

// ─── Client Events ────────────────────────────────────────────────────────────

export type HaClientEvent =
  | { type: "connected" }
  | { type: "disconnected"; reason: string }
  | { type: "state_changed"; entityState: EntityState }
  | { type: "error"; error: Error };

export type HaClientEventListener = (event: HaClientEvent) => void;

// ─── Calendar ─────────────────────────────────────────────────────────────────

export interface HaCalendarEvent {
  summary: string;
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  description?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface HaClientConfig {
  baseUrl: string;
  token: string;
  /** Reconnect delay in ms (default 2000, doubles each attempt up to maxReconnectDelay) */
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  /** How often to send a ping to detect silent disconnects (default 30000ms) */
  pingInterval?: number;
  /** How long to wait for a pong before treating the connection as dead (default 10000ms) */
  pingTimeout?: number;
}
