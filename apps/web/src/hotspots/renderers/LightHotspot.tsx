import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LightConfig } from "@floorplan-ha/shared";
import type { HotspotRaw, HotspotRendererProps } from "../types.ts";
import type { EntityState } from "@floorplan-ha/shared";
import { api } from "../../api/client.ts";
import { useToastStore } from "../../store/toast.ts";
import { ICON_PATHS } from "../icons.ts";

const LONG_PRESS_DELAY_MS = 600;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function loadPresets(entityId: string): (string | null)[] {
  try {
    const raw = localStorage.getItem(`fp_light_presets_${entityId}`);
    if (!raw) return [null, null, null, null, null];
    const parsed = JSON.parse(raw) as unknown[];
    const slots = Array.from({ length: 5 }, (_, i) =>
      typeof parsed[i] === "string" ? (parsed[i] as string) : null,
    );
    return slots;
  } catch {
    return [null, null, null, null, null];
  }
}

function savePresets(entityId: string, presets: (string | null)[]): void {
  localStorage.setItem(`fp_light_presets_${entityId}`, JSON.stringify(presets));
}

export function LightHotspot({
  hotspot,
  entityState,
  ruleResult,
  isEditMode,
}: HotspotRendererProps) {
  const config = hotspot.configJson as LightConfig;
  const [showModal, setShowModal] = useState(false);
  const stateStyle = ruleResult?.styleOverrides ?? {};

  const state = entityState?.state ?? "unknown";
  const isOn = state === "on";

  const brightness =
    typeof entityState?.attributes?.brightness === "number"
      ? entityState.attributes.brightness
      : null;

  const rgbColor =
    Array.isArray(entityState?.attributes?.rgb_color) &&
    (entityState.attributes.rgb_color as unknown[]).length === 3
      ? (entityState.attributes.rgb_color as [number, number, number])
      : null;

  const iconKey = config.icon || "mdi:lightbulb";
  const label = ruleResult?.textOverride ?? config.label;
  const brightnessPct = brightness !== null ? Math.round(brightness / 2.55) : null;

  const configBg = config.backgroundColor ?? null;
  const hasCustomBg = stateStyle.backgroundColor != null || configBg != null;
  const resolvedBg =
    stateStyle.backgroundColor ??
    (configBg === "transparent" ? "transparent" : configBg ?? undefined);

  const resolvedIconColor =
    stateStyle.color ??
    (isOn && rgbColor ? rgbToHex(...rgbColor) : isOn ? (config.onColor ?? undefined) : (config.offColor ?? undefined));

  // ── Long-press detection ──────────────────────────────────────────────────
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const handlePointerDown = useCallback(
    (_e: React.PointerEvent<HTMLButtonElement>) => {
      if (isEditMode) return;
      longPressFired.current = false;
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        setShowModal(true);
      }, LONG_PRESS_DELAY_MS);
    },
    [isEditMode],
  );

  const addToast = useToastStore((s) => s.addToast);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressFired.current && !isEditMode) {
      const entityId = hotspot.entityId;
      if (!entityId) return;
      api.ha
        .callService("light", "toggle", { target: { entityId } })
        .catch((err: unknown) =>
          addToast(
            `Light toggle failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            "error",
          ),
        );
    }
  }, [isEditMode, hotspot.entityId, addToast]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressFired.current = false;
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label={hotspot.name}
        disabled={isEditMode}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        className={[
          "relative flex h-full w-full select-none flex-col items-center justify-center gap-0.5 rounded-lg",
          "min-h-[44px] min-w-[44px] transition-all duration-100",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
          !hasCustomBg && isOn ? "bg-yellow-400/20 text-yellow-200 hover:bg-yellow-400/30" : "",
          !hasCustomBg && !isOn ? "bg-white/10 text-white/70 hover:bg-white/20" : "",
          isEditMode ? "pointer-events-none" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          color: stateStyle.color ?? undefined,
          backgroundColor: resolvedBg,
          opacity: stateStyle.opacity ?? undefined,
          boxShadow: stateStyle.glow ? `0 0 12px 4px ${stateStyle.glow}` : undefined,
        }}
      >
        <svg viewBox="0 0 24 24" className="w-1/2 shrink-0" aria-hidden="true">
          <path
            d={ICON_PATHS[iconKey] ?? ICON_PATHS["default"]}
            fill={resolvedIconColor ?? "currentColor"}
          />
        </svg>
        {label && (
          <span className="truncate px-1 text-xs font-medium leading-tight">{label}</span>
        )}
        {config.showBrightnessLabel && brightnessPct !== null && isOn && (
          <span className="text-[10px] tabular-nums opacity-70">{brightnessPct}%</span>
        )}
      </button>

      {showModal && (
        <LightControlModal
          hotspot={hotspot}
          entityState={entityState}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Light Control Modal ───────────────────────────────────────────────────────

interface LightControlModalProps {
  hotspot: HotspotRaw;
  entityState: EntityState | undefined;
  onClose: () => void;
}

function LightControlModal({ hotspot, entityState, onClose }: LightControlModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const entityId = hotspot.entityId ?? "";

  const state = entityState?.state ?? "unknown";
  const isOn = state === "on";

  const haBrightness =
    typeof entityState?.attributes?.brightness === "number"
      ? entityState.attributes.brightness
      : 255;

  const haRgb =
    Array.isArray(entityState?.attributes?.rgb_color) &&
    (entityState.attributes.rgb_color as unknown[]).length === 3
      ? (entityState.attributes.rgb_color as [number, number, number])
      : null;

  const [localBrightness, setLocalBrightness] = useState<number>(
    Math.round(haBrightness / 2.55),
  );
  const [localColor, setLocalColor] = useState<string>(
    haRgb ? rgbToHex(...haRgb) : "#ffffff",
  );
  const [presets, setPresets] = useState<(string | null)[]>(() => loadPresets(entityId));
  const [isPending, setIsPending] = useState(false);
  const isDraggingBrightness = useRef(false);

  // Preset long-press tracking (per slot index)
  const presetTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>([
    null, null, null, null, null,
  ]);

  // Sync brightness from HA when not dragging
  useEffect(() => {
    if (!isDraggingBrightness.current) {
      setLocalBrightness(Math.round(haBrightness / 2.55));
    }
  }, [haBrightness]);

  // Sync color from HA
  useEffect(() => {
    if (haRgb) setLocalColor(rgbToHex(...haRgb));
  }, [haRgb]);

  const callLight = useCallback(
    async (service: string, serviceData?: Record<string, unknown>) => {
      if (!entityId || isPending) return;
      setIsPending(true);
      try {
        await api.ha.callService("light", service, {
          serviceData,
          target: { entityId },
        });
      } catch (err) {
        addToast(
          `Light call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          "error",
        );
      } finally {
        setIsPending(false);
      }
    },
    [entityId, isPending, addToast],
  );

  const applyBrightness = useCallback(
    (pct: number) => {
      const clamped = Math.round(Math.max(1, Math.min(100, pct)));
      void callLight("turn_on", { brightness: Math.round(clamped * 2.55) });
    },
    [callLight],
  );

  const applyColor = useCallback(
    (hex: string) => {
      setLocalColor(hex);
      void callLight("turn_on", { rgb_color: hexToRgb(hex) });
    },
    [callLight],
  );

  // ── Preset handlers ────────────────────────────────────────────────────────

  const handlePresetPointerDown = useCallback(
    (index: number) => {
      presetTimers.current[index] = setTimeout(() => {
        presetTimers.current[index] = null;
        const updated = [...presets];
        updated[index] = localColor;
        setPresets(updated);
        savePresets(entityId, updated);
      }, LONG_PRESS_DELAY_MS);
    },
    [presets, localColor, entityId],
  );

  const handlePresetPointerUp = useCallback(
    (index: number) => {
      const timer = presetTimers.current[index];
      if (timer !== null) {
        clearTimeout(timer);
        presetTimers.current[index] = null;
        const color = presets[index];
        if (color) applyColor(color);
      }
    },
    [presets, applyColor],
  );

  const handlePresetPointerCancel = useCallback((index: number) => {
    if (presetTimers.current[index] !== null) {
      clearTimeout(presetTimers.current[index]!);
      presetTimers.current[index] = null;
    }
  }, []);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-surface-raised pb-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">{hotspot.name}</h2>
            {entityId && <p className="mt-0.5 text-[11px] text-gray-500">{entityId}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                isOn
                  ? "bg-yellow-500/20 text-yellow-300"
                  : "bg-gray-500/20 text-gray-400",
              ].join(" ")}
            >
              {state}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-lg leading-none text-gray-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5 px-5 pt-5">
          {/* Power buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void callLight("turn_on")}
              disabled={isPending}
              className={[
                "flex-1 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-40",
                isOn
                  ? "bg-yellow-400/30 text-yellow-200 ring-1 ring-yellow-400/50"
                  : "bg-white/10 text-white/60 hover:bg-white/20",
              ].join(" ")}
            >
              On
            </button>
            <button
              type="button"
              onClick={() => void callLight("turn_off")}
              disabled={isPending}
              className={[
                "flex-1 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-40",
                !isOn
                  ? "bg-gray-400/20 text-gray-300 ring-1 ring-gray-400/40"
                  : "bg-white/10 text-white/60 hover:bg-white/20",
              ].join(" ")}
            >
              Off
            </button>
          </div>

          {/* Brightness */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium text-gray-400">Brightness</p>
              <span className="text-[11px] tabular-nums text-gray-400">{localBrightness}%</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-500" aria-hidden="true">🌑</span>
              <input
                type="range"
                min={1}
                max={100}
                value={localBrightness}
                aria-label="Brightness"
                className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-yellow-400"
                onPointerDown={() => {
                  isDraggingBrightness.current = true;
                }}
                onChange={(e) => setLocalBrightness(Number(e.target.value))}
                onPointerUp={(e) => {
                  isDraggingBrightness.current = false;
                  applyBrightness(Number((e.target as HTMLInputElement).value));
                }}
              />
              <span className="text-[11px] text-yellow-300" aria-hidden="true">☀️</span>
            </div>
          </div>

          {/* Colour */}
          <div>
            <p className="mb-2 text-[11px] font-medium text-gray-400">Colour</p>
            <label className="flex cursor-pointer items-center gap-3">
              <span
                className="h-10 w-10 shrink-0 rounded-lg border border-white/20 shadow-inner"
                style={{ backgroundColor: localColor }}
                aria-hidden="true"
              />
              <span className="flex-1 text-[11px] font-mono text-gray-400">{localColor}</span>
              <input
                type="color"
                value={localColor}
                aria-label="Pick colour"
                className="h-0 w-0 opacity-0"
                onChange={(e) => setLocalColor(e.target.value)}
                onBlur={(e) => applyColor(e.target.value)}
              />
              <span className="rounded-md bg-white/10 px-3 py-1.5 text-[11px] text-white hover:bg-white/20">
                Pick
              </span>
            </label>
          </div>

          {/* Preset swatches */}
          <div>
            <p className="mb-2 text-[11px] font-medium text-gray-400">
              Presets{" "}
              <span className="font-normal text-gray-600">— tap to apply · hold to save</span>
            </p>
            <div className="flex gap-2">
              {presets.map((color, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={
                    color ? `Preset ${index + 1}: ${color}` : `Save current colour to preset ${index + 1}`
                  }
                  onPointerDown={() => handlePresetPointerDown(index)}
                  onPointerUp={() => handlePresetPointerUp(index)}
                  onPointerCancel={() => handlePresetPointerCancel(index)}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex h-10 flex-1 items-center justify-center rounded-lg border border-white/20 transition-opacity hover:opacity-80"
                  style={{ backgroundColor: color ?? "transparent" }}
                >
                  {!color && (
                    <span className="text-base leading-none text-white/30">+</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
