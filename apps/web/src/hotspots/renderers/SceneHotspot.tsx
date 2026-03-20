import { useCallback, useState } from "react";
import type { SceneConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { api } from "../../api/client.ts";
import { useToastStore } from "../../store/toast.ts";

/**
 * Scene/group hotspot: a single-tap button that triggers a Home Assistant
 * scene or script. Simpler than ActionHotspot — no hold/double-tap, no
 * state-based toggle styling.
 *
 * Displays a configurable label and/or icon name.
 */
export function SceneHotspot({ hotspot, ruleResult }: HotspotRendererProps) {
  const config = hotspot.configJson as SceneConfig;
  const addToast = useToastStore((s) => s.addToast);

  const [isPending, setIsPending] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const stateStyle = ruleResult?.styleOverrides ?? {};
  const label = ruleResult?.textOverride ?? config.label ?? hotspot.name;

  const handleTap = useCallback(async () => {
    if (isPending || !config.serviceCall) return;
    setIsPending(true);
    try {
      const { domain, service, serviceData, target } = config.serviceCall;
      await api.ha.callService(domain, service, { serviceData, target });
    } catch (err) {
      addToast(
        `Scene call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setIsPending(false);
    }
  }, [isPending, config.serviceCall, addToast]);

  return (
    <button
      type="button"
      aria-label={hotspot.name}
      aria-busy={isPending}
      onPointerDown={() => setIsPressed(true)}
      onPointerUp={() => {
        setIsPressed(false);
        void handleTap();
      }}
      onPointerCancel={() => setIsPressed(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={[
        "flex h-full w-full select-none flex-col items-center justify-center gap-1 rounded-lg",
        "min-h-[44px] min-w-[44px]",
        "transition-all duration-100",
        "bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400",
        isPending ? "opacity-50" : "",
        isPressed ? "scale-90 opacity-80" : "scale-100 opacity-100",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        color: stateStyle.color,
        backgroundColor: stateStyle.backgroundColor,
        opacity: stateStyle.opacity ?? undefined,
        boxShadow: stateStyle.glow ? `0 0 12px 4px ${stateStyle.glow}` : undefined,
      }}
    >
      {isPending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <>
          {config.icon && (
            <span className="text-base leading-none" aria-hidden="true">
              {config.icon}
            </span>
          )}
          <span className="truncate px-1 text-xs font-medium">{label}</span>
        </>
      )}
    </button>
  );
}
