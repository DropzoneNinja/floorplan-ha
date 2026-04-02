import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EntityState } from "@floorplan-ha/shared";
import { useEntityStateStore } from "../store/entity-states.ts";

/**
 * Opens an SSE connection to /api/state/stream.
 * Populates the entity state store with the initial snapshot and live updates.
 * Auto-reconnects on disconnect.
 */
export function useStateStream() {
  const qc = useQueryClient();
  const setStates = useEntityStateStore((s) => s.setStates);
  const updateState = useEntityStateStore((s) => s.updateState);
  const setConnectionStatus = useEntityStateStore((s) => s.setConnectionStatus);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function connect() {
      const es = new EventSource("/api/state/stream", { withCredentials: true });
      esRef.current = es;

      es.addEventListener("init", (e: MessageEvent) => {
        attempt = 0;
        const data = JSON.parse(e.data) as { states: EntityState[]; connected: boolean };
        setStates(data.states);
        setConnectionStatus({ connected: data.connected, lastConnectedAt: new Date().toISOString(), error: null });
      });

      es.addEventListener("state_changed", (e: MessageEvent) => {
        const entityState = JSON.parse(e.data) as EntityState;
        updateState(entityState);
      });

      es.addEventListener("settings_changed", () => {
        void qc.invalidateQueries({ queryKey: ["settings"] });
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        setConnectionStatus({ connected: false, lastConnectedAt: null, error: "Stream disconnected" });
        // Exponential backoff: 2s, 4s, 8s ... up to 30s
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        attempt++;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      esRef.current?.close();
    };
  }, [setStates, updateState, setConnectionStatus, qc]);
}
