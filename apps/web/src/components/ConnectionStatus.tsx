import { useEntityStateStore } from "../store/entity-states.ts";

/**
 * Subtle connection status indicator shown in presentation mode.
 * Only visible when disconnected — invisible when connected.
 */
export function ConnectionStatus() {
  const status = useEntityStateStore((s) => s.connectionStatus);

  if (status.connected) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-yellow-900/80 px-3 py-1.5 text-xs text-yellow-200 backdrop-blur-sm"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
      Home Assistant disconnected
    </div>
  );
}
