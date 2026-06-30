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
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPingId: number | null = null;

  private readonly reconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private readonly pingInterval: number;
  private readonly pingTimeout: number;
  private readonly wsUrl: string;
  private readonly token: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly pendingCommands = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  constructor(private readonly config: HaClientConfig) {
    this.wsUrl = config.baseUrl.replace(/^http/, "ws").replace(/\/$/, "") + "/api/websocket";
    this.token = config.token;
    this.reconnectDelay = config.reconnectDelay ?? 2000;
    this.maxReconnectDelay = config.maxReconnectDelay ?? 30000;
    this.pingInterval = config.pingInterval ?? 30000;
    this.pingTimeout = config.pingTimeout ?? 10000;
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
    this.stopPing();
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
      this.stopPing();
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
        this.startPing();
        break;

      case "auth_invalid":
        this.emit({ type: "error", error: new Error(`HA auth invalid: ${msg.message}`) });
        this.shouldReconnect = false;
        this.ws?.close();
        break;

      case "pong":
        if (this.pendingPingId !== null && msg.id === this.pendingPingId) {
          this.pendingPingId = null;
          if (this.pingTimeoutTimer) {
            clearTimeout(this.pingTimeoutTimer);
            this.pingTimeoutTimer = null;
          }
          // Schedule next ping
          this.pingTimer = setTimeout(() => this.sendPing(), this.pingInterval);
        }
        break;

      case "result": {
        const pending = this.pendingCommands.get(msg.id);
        if (pending) {
          this.pendingCommands.delete(msg.id);
          if (msg.success) {
            pending.resolve(msg.result);
          } else {
            pending.reject(new Error(`HA WS error [${msg.error?.code}]: ${msg.error?.message}`));
          }
        } else {
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
        }
        break;
      }

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

  private startPing(): void {
    this.pingTimer = setTimeout(() => this.sendPing(), this.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      this.pingTimeoutTimer = null;
    }
    this.pendingPingId = null;
  }

  private sendPing(): void {
    this.pingTimer = null;
    if (this.state !== "connected" || !this.ws) return;

    const id = this.nextId();
    this.pendingPingId = id;
    this.ws.send(JSON.stringify({ id, type: "ping" }));

    this.pingTimeoutTimer = setTimeout(() => {
      // No pong received — connection is silently dead, force close to trigger reconnect
      console.warn("[ha-ws] Ping timeout — forcing reconnect");
      this.pingTimeoutTimer = null;
      this.pendingPingId = null;
      this.ws?.terminate();
    }, this.pingTimeout);
  }

  /** Send a one-shot WebSocket command and return the result. Rejects if not connected. */
  sendCommand<T>(type: string, payload: Record<string, unknown>, timeoutMs = 10000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.state !== "connected" || !this.ws) {
        reject(new Error("HA WebSocket not connected"));
        return;
      }
      const id = this.nextId();
      const timer = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error(`HA WS command '${type}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pendingCommands.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v as T); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.ws.send(JSON.stringify({ id, type, ...payload }));
    });
  }

  /** Long-term statistics (survives history purge). Uses WS because HA has no REST equivalent. */
  getStatisticsDuringPeriod(
    entityId: string,
    startTime: string,
    endTime: string,
    period: "5minute" | "hour" | "day" | "week" | "month",
    types: Array<"max" | "min" | "mean" | "sum" | "state" | "change">,
  // HA returns `start` as epoch milliseconds (number), not an ISO string
  ): Promise<Array<{ start: number; max: number | null; min: number | null; mean: number | null; sum: number | null; state: number | null; change: number | null }>> {
    return this.sendCommand<Record<string, Array<{ start: number; max?: number | null; min?: number | null; mean?: number | null; sum?: number | null; state?: number | null; change?: number | null }>>>(
      "recorder/statistics_during_period",
      { start_time: startTime, end_time: endTime, statistic_ids: [entityId], period, types },
    ).then((raw) =>
      (raw[entityId] ?? []).map((s) => ({
        start: s.start,
        max: s.max ?? null,
        min: s.min ?? null,
        mean: s.mean ?? null,
        sum: s.sum ?? null,
        state: s.state ?? null,
        change: s.change ?? null,
      })),
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
