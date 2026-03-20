import { useCallback, useRef, useState } from "react";
import type { ActionConfig, ServiceCall } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { api } from "../../api/client.ts";
import { useToastStore } from "../../store/toast.ts";

const LONG_PRESS_DELAY_MS = 600;
const DOUBLE_TAP_WINDOW_MS = 300;

/**
 * Action hotspot: a touch-friendly button that calls a Home Assistant service.
 * Supports tap, long-press, and double-tap actions.
 */
export function ActionHotspot({ hotspot, entityState, ruleResult }: HotspotRendererProps) {
  const config = hotspot.configJson as ActionConfig;
  const addToast = useToastStore((s) => s.addToast);

  const [isPending, setIsPending] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef<number>(0);

  const executeService = useCallback(
    async (serviceCall: ServiceCall) => {
      if (isPending) return;
      setIsPending(true);
      try {
        await api.ha.callService(serviceCall.domain, serviceCall.service, {
          serviceData: serviceCall.serviceData,
          target: serviceCall.target,
        });
      } catch (err) {
        addToast(
          `Service call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          "error",
        );
      } finally {
        setIsPending(false);
      }
    },
    [isPending, addToast],
  );

  const handlePointerDown = useCallback(() => {
    setIsPressed(true);
    if (config.holdAction) {
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        setIsPressed(false);
        executeService(config.holdAction!);
      }, LONG_PRESS_DELAY_MS);
    }
  }, [config.holdAction, executeService]);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
    const hadLongPressTimer = longPressTimer.current !== null;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // Only fire tap if long press wasn't triggered
    if (hadLongPressTimer || !config.holdAction) {
      if (!config.tapAction) return;
      const now = Date.now();
      const elapsed = now - lastTapTime.current;
      if (config.doubleTapAction && elapsed < DOUBLE_TAP_WINDOW_MS) {
        lastTapTime.current = 0;
        executeService(config.doubleTapAction);
      } else {
        lastTapTime.current = now;
        executeService(config.tapAction);
      }
    }
  }, [config, executeService]);

  const handlePointerCancel = useCallback(() => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Apply rule-result style overrides
  const stateStyle = ruleResult?.styleOverrides ?? {};
  const label = ruleResult?.textOverride ?? config.label;
  const isOn =
    entityState?.state === "on" ||
    entityState?.state === "open" ||
    entityState?.state === "active";

  // Config-level background overrides the class-based default; rule results override config.
  const resolvedBg = stateStyle.backgroundColor ?? config.backgroundColor ?? undefined;
  const hasCustomBg = resolvedBg != null;

  return (
    <button
      type="button"
      aria-label={hotspot.name}
      aria-busy={isPending}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      // Prevent context menu on long-press in browsers
      onContextMenu={(e) => e.preventDefault()}
      className={[
        "flex h-full w-full select-none items-center justify-center rounded-lg",
        "min-h-[44px] min-w-[44px]",
        "transition-all duration-100",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        isPending ? "opacity-50" : "",
        isPressed ? "scale-90 opacity-80" : "scale-100 opacity-100",
        // Only apply default background classes when no custom background is configured
        !hasCustomBg
          ? isOn
            ? "bg-yellow-400/20 text-yellow-200"
            : "bg-white/10 text-white/80 hover:bg-white/20"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        color: stateStyle.color,
        backgroundColor: resolvedBg,
        opacity: stateStyle.opacity ?? undefined,
        borderColor: stateStyle.borderColor,
        boxShadow: stateStyle.glow ? `0 0 12px 4px ${stateStyle.glow}` : undefined,
      }}
    >
      {isPending ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : config.hideLabel ? null : (
        <span className="truncate px-1 text-sm font-medium">{label}</span>
      )}
    </button>
  );
}
