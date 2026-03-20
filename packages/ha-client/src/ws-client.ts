import WebSocket from "ws";
import type { EntityState } from "@floorplan-ha/shared";
import type {
  HaClientConfig,
  HaClientEvent,
  HaClientEventListener,
  HaStateChangedEventData,
  HaWsMessage,
} from "./types.js";
import { normalizeState } from "./normalizer.js";

type WsState = "disconnected" | "connecting" | "authenticating" | "connected";

/**
 * WebSocket client for the Home Assistant real-time API.
 *
 * Usage:
 *   const client = new HaWebSocketClient(config);
 *   client.on((event) => { ... });
 *   await client.connect();
 */
export class HaWebSocketClient {
  private ws: WebSocket | null = null;
  private state: WsState = "disconnected";
  private msgId = 1;
  private listeners: HaClientEventListener[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private subscriptionId: number | null = null;

  private readonly reconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private readonly wsUrl: string;
  private readonly token: string;

  constructor(private readonly config: HaClientConfig) {
    this.wsUrl = config.baseUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/api/websocket";
    this.token = config.token;
    this.reconnectDelay = config.reconnectDelay ?? 2000;
    this.maxReconnectDelay = config.maxReconnectDelay ?? 30000;
  }

  on(listener: HaClientEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: HaClientEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private nextId(): number {
    return this.msgId++;
  }

  connect(): void {
    if (this.state !== "disconnected") return;
    this.shouldReconnect = true;
    this.doConnect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.state = "disconnected";
  }

  private doConnect(): void {
    this.state = "connecting";
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;

    ws.on("open", () => {
      // HA sends auth_required first; we wait for it in onMessage
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString()) as HaWsMessage;
        this.onMessage(msg);
      } catch (err) {
        this.emit({ type: "error", error: err instanceof Error ? err : new Error(String(err)) });
      }
    });

    ws.on("close", (code, reason) => {
      this.state = "disconnected";
      this.subscriptionId = null;
      const reasonStr = reason?.toString() ?? `code ${code}`;
      this.emit({ type: "disconnected", reason: reasonStr });

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });

    ws.on("error", (err) => {
      this.emit({ type: "error", error: err });
    });
  }

  private onMessage(msg: HaWsMessage): void {
    switch (msg.type) {
      case "auth_required":
        this.state = "authenticating";
        this.ws?.send(JSON.stringify({ type: "auth", access_token: this.token }));
        break;

      case "auth_ok":
        this.state = "connected";
        this.reconnectAttempts = 0;
        this.emit({ type: "connected" });
        this.subscribeStateChanges();
        break;

      case "auth_invalid":
        this.emit({ type: "error", error: new Error(`HA auth invalid: ${msg.message}`) });
        this.shouldReconnect = false;
        this.ws?.close();
        break;

      case "result":
        if (!msg.success && msg.error) {
          this.emit({
            type: "error",
            error: new Error(`HA WS error [${msg.error.code}]: ${msg.error.message}`),
          });
        }
        // If this is the subscribe confirmation, record the subscription id
        if (msg.success && this.subscriptionId === null) {
          this.subscriptionId = msg.id;
        }
        break;

      case "event":
        if (msg.event.event_type === "state_changed") {
          const data = msg.event.data as HaStateChangedEventData;
          if (data.new_state) {
            const entityState: EntityState = normalizeState(data.new_state);
            this.emit({ type: "state_changed", entityState });
          }
        }
        break;
    }
  }

  private subscribeStateChanges(): void {
    const id = this.nextId();
    this.ws?.send(
      JSON.stringify({
        id,
        type: "subscribe_events",
        event_type: "state_changed",
      }),
    );
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  get isConnected(): boolean {
    return this.state === "connected";
  }
}
