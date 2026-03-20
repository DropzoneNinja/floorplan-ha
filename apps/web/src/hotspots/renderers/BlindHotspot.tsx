import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { BlindConfig } from "@floorplan-ha/shared";
import type { HotspotRaw, HotspotRendererProps } from "../types.ts";
import type { EntityState } from "@floorplan-ha/shared";
import { api } from "../../api/client.ts";
import { useToastStore } from "../../store/toast.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";
import { ICON_PATHS } from "../icons.ts";

const LONG_PRESS_DELAY_MS = 600;

/**
 * Blind / cover hotspot: tap to open a position control modal.
 * Long-press opens a group control modal that sends commands to all entities
 * listed in config.groupEntityIds simultaneously.
 * Binds to a Home Assistant cover entity (entity_id stored on hotspot.entityId).
 */
export function BlindHotspot({
  hotspot,
  entityState,
  ruleResult,
  isEditMode,
}: HotspotRendererProps) {
  const config = hotspot.configJson as BlindConfig;
  const [showModal, setShowModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const stateStyle = ruleResult?.styleOverrides ?? {};

  const state = entityState?.state ?? "unknown";
  const position =
    typeof entityState?.attributes?.current_position === "number"
      ? entityState.attributes.current_position
      : null;

  const isOpen = state === "open" || state === "opening";
  const isMoving = state === "opening" || state === "closing";

  const iconKey = config.icon || "mdi:blinds";
  const label = ruleResult?.textOverride ?? config.label;
  const groupEntityIds = config.groupEntityIds ?? [];
  const hasGroup = groupEntityIds.length > 0;

  // Resolve background: rule overrides take priority, then config, then default Tailwind classes
  const configBg = config.backgroundColor ?? null;
  const hasCustomBg = stateStyle.backgroundColor != null || configBg != null;
  const resolvedBg =
    stateStyle.backgroundColor ??
    (configBg === "transparent" ? "transparent" : configBg ?? undefined);

  // ── Long-press detection ──────────────────────────────────────────────────
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (isEditMode) return;
      longPressFired.current = false;
      if (hasGroup) {
        longPressTimer.current = setTimeout(() => {
          longPressFired.current = true;
          setShowGroupModal(true);
        }, LONG_PRESS_DELAY_MS);
      }
    },
    [isEditMode, hasGroup],
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressFired.current && !isEditMode) {
      setShowModal(true);
    }
  }, [isEditMode]);

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
          !hasCustomBg && isOpen ? "bg-sky-400/20 text-sky-200 hover:bg-sky-400/30" : "",
          !hasCustomBg && !isOpen ? "bg-white/10 text-white/70 hover:bg-white/20" : "",
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
          <path d={ICON_PATHS[iconKey] ?? ICON_PATHS["default"]} fill="currentColor" />
        </svg>
        {label && (
          <span className="truncate px-1 text-xs font-medium leading-tight">{label}</span>
        )}
        {position !== null && (
          <span className="text-[10px] tabular-nums opacity-70">{position}%</span>
        )}
        {isMoving && (
          <span className="absolute bottom-1 right-1 h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
        )}
        {hasGroup && (
          <span className="absolute left-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/20 text-[8px] font-bold leading-none text-white/70">
            {groupEntityIds.length}
          </span>
        )}
      </button>

      {showModal && (
        <BlindControlModal
          hotspot={hotspot}
          entityState={entityState}
          onClose={() => setShowModal(false)}
        />
      )}

      {showGroupModal && (
        <BlindGroupModal
          hotspot={hotspot}
          groupEntityIds={groupEntityIds}
          onClose={() => setShowGroupModal(false)}
        />
      )}
    </>
  );
}

// ─── Single-entity Modal ───────────────────────────────────────────────────────

interface BlindControlModalProps {
  hotspot: HotspotRaw;
  entityState: EntityState | undefined;
  onClose: () => void;
}

function BlindControlModal({ hotspot, entityState, onClose }: BlindControlModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const entityId = hotspot.entityId;

  const haPosition =
    typeof entityState?.attributes?.current_position === "number"
      ? entityState.attributes.current_position
      : 50;
  const state = entityState?.state ?? "unknown";

  const [localPosition, setLocalPosition] = useState<number>(haPosition);
  const [isPending, setIsPending] = useState(false);
  const isDragging = useRef(false);

  // Sync from HA state when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setLocalPosition(haPosition);
    }
  }, [haPosition]);

  const frameRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartPos = useRef<number>(0);

  // ── Service calls ─────────────────────────────────────────────────────────

  const callCover = useCallback(
    async (service: string, serviceData?: Record<string, unknown>) => {
      if (!entityId || isPending) return;
      setIsPending(true);
      try {
        await api.ha.callService("cover", service, {
          serviceData,
          target: { entityId },
        });
      } catch (err) {
        addToast(
          `Cover call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          "error",
        );
      } finally {
        setIsPending(false);
      }
    },
    [entityId, isPending, addToast],
  );

  const applyPosition = useCallback(
    (pct: number) => {
      const clamped = Math.round(Math.max(0, Math.min(100, pct)));
      setLocalPosition(clamped);
      void callCover("set_cover_position", { position: clamped });
    },
    [callCover],
  );

  // ── Drag handling ──────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDragging.current = true;
      dragStartY.current = e.clientY;
      dragStartPos.current = localPosition;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [localPosition],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const frame = frameRef.current;
    if (!frame) return;
    const frameH = frame.getBoundingClientRect().height;
    const dy = e.clientY - dragStartY.current;
    // Up = open (position increases), down = close (position decreases)
    const deltaPct = (dy / frameH) * 100;
    const newPos = Math.round(Math.max(0, Math.min(100, dragStartPos.current - deltaPct)));
    setLocalPosition(newPos);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    applyPosition(localPosition);
  }, [localPosition, applyPosition]);

  // ── Visual ────────────────────────────────────────────────────────────────

  const SLAT_COUNT = 8;
  const shadeHeightPct = 100 - localPosition;

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
                state === "open"
                  ? "bg-sky-500/20 text-sky-300"
                  : state === "closed"
                    ? "bg-gray-500/20 text-gray-400"
                    : "bg-amber-500/20 text-amber-300",
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

        {/* Main content */}
        <div className="flex items-start justify-center gap-6 px-6 pt-6">
          {/* Quick action buttons */}
          <div className="flex flex-col items-center justify-between self-stretch py-2">
            <QuickButton label="Open" onClick={() => applyPosition(100)} disabled={isPending} />
            <QuickButton label="½" onClick={() => applyPosition(50)} disabled={isPending} />
            <QuickButton label="Close" onClick={() => applyPosition(0)} disabled={isPending} />
          </div>

          {/* Blind visual */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-white">
              {localPosition}
              <span className="text-base font-normal text-gray-400">%</span>
            </span>

            {/* Window frame — drag target */}
            <div
              ref={frameRef}
              className="relative touch-none select-none overflow-hidden rounded-sm border-2 border-white/20 bg-gray-900"
              style={{ width: 100, height: 200, cursor: "ns-resize" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              role="slider"
              aria-label={`Blind position: ${localPosition}%`}
              aria-valuenow={localPosition}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {/* Slats */}
              {Array.from({ length: SLAT_COUNT }, (_, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0 border-b border-gray-600/40 bg-gray-700/60"
                  style={{
                    top: `${(i / SLAT_COUNT) * 100}%`,
                    height: `${100 / SLAT_COUNT}%`,
                  }}
                />
              ))}

              {/* Shade panel — covers from top down */}
              <div
                className="absolute inset-x-0 top-0 bg-gray-500/80"
                style={{ height: `${shadeHeightPct}%` }}
                aria-hidden="true"
              />

              {/* Drag handle at shade boundary */}
              {shadeHeightPct < 100 && shadeHeightPct > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center"
                  style={{ top: `${shadeHeightPct}%`, transform: "translateY(-50%)" }}
                  aria-hidden="true"
                >
                  <div className="h-0.5 w-full bg-sky-400/80 shadow-[0_0_4px_1px_rgba(56,189,248,0.6)]" />
                  <div className="absolute h-3 w-6 rounded-sm bg-sky-400 shadow-md" />
                </div>
              )}
            </div>

            <p className="text-[11px] text-gray-500">Drag to set position</p>
          </div>
        </div>

        {/* Stop button — shown when cover is moving */}
        {(state === "opening" || state === "closing") && (
          <div className="mt-4 flex justify-center px-6">
            <button
              type="button"
              onClick={() => void callCover("stop_cover")}
              disabled={isPending}
              className="rounded-lg bg-amber-500/20 px-6 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-40"
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ─── Group Modal ───────────────────────────────────────────────────────────────

interface BlindGroupModalProps {
  hotspot: HotspotRaw;
  groupEntityIds: string[];
  onClose: () => void;
}

function BlindGroupModal({ hotspot, groupEntityIds, onClose }: BlindGroupModalProps) {
  const addToast = useToastStore((s) => s.addToast);
  const getEntityState = useEntityStateStore((s) => s.getState);

  const initialPosition = groupEntityIds.reduce<number>((min, id) => {
    const pos = getEntityState(id)?.attributes?.current_position;
    return typeof pos === "number" ? Math.min(min, pos) : min;
  }, 100);

  const [localPosition, setLocalPosition] = useState(initialPosition);
  const [isPending, setIsPending] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartPos = useRef<number>(0);
  const isDragging = useRef(false);

  // ── Service calls ─────────────────────────────────────────────────────────

  const callAll = useCallback(
    async (service: string, serviceData?: Record<string, unknown>) => {
      if (isPending) return;
      setIsPending(true);
      try {
        await Promise.all(
          groupEntityIds.map((entityId) =>
            api.ha.callService("cover", service, {
              serviceData,
              target: { entityId },
            }),
          ),
        );
      } catch (err) {
        addToast(
          `Group cover call failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          "error",
        );
      } finally {
        setIsPending(false);
      }
    },
    [groupEntityIds, isPending, addToast],
  );

  const applyPosition = useCallback(
    (pct: number) => {
      const clamped = Math.round(Math.max(0, Math.min(100, pct)));
      setLocalPosition(clamped);
      void callAll("set_cover_position", { position: clamped });
    },
    [callAll],
  );

  // ── Drag handling ──────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDragging.current = true;
      dragStartY.current = e.clientY;
      dragStartPos.current = localPosition;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [localPosition],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const frame = frameRef.current;
    if (!frame) return;
    const frameH = frame.getBoundingClientRect().height;
    const dy = e.clientY - dragStartY.current;
    const deltaPct = (dy / frameH) * 100;
    const newPos = Math.round(Math.max(0, Math.min(100, dragStartPos.current - deltaPct)));
    setLocalPosition(newPos);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    applyPosition(localPosition);
  }, [localPosition, applyPosition]);

  // ── Visual ────────────────────────────────────────────────────────────────

  const SLAT_COUNT = 8;
  const shadeHeightPct = 100 - localPosition;

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
            <h2 className="text-sm font-semibold text-white">{hotspot.name} — Group</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">
              Controls {groupEntityIds.length} blind{groupEntityIds.length !== 1 ? "s" : ""} simultaneously
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-gray-500 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Main content */}
        <div className="flex items-start justify-center gap-6 px-6 pt-6">
          {/* Quick action buttons */}
          <div className="flex flex-col items-center justify-between self-stretch py-2">
            <QuickButton label="Open" onClick={() => applyPosition(100)} disabled={isPending} />
            <QuickButton label="½" onClick={() => applyPosition(50)} disabled={isPending} />
            <QuickButton label="Close" onClick={() => applyPosition(0)} disabled={isPending} />
          </div>

          {/* Blind visual */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-white">
              {localPosition}
              <span className="text-base font-normal text-gray-400">%</span>
            </span>

            {/* Window frame — drag target */}
            <div
              ref={frameRef}
              className="relative touch-none select-none overflow-hidden rounded-sm border-2 border-white/20 bg-gray-900"
              style={{ width: 100, height: 200, cursor: "ns-resize" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              role="slider"
              aria-label={`Group blind position: ${localPosition}%`}
              aria-valuenow={localPosition}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              {/* Slats */}
              {Array.from({ length: SLAT_COUNT }, (_, i) => (
                <div
                  key={i}
                  className="absolute inset-x-0 border-b border-gray-600/40 bg-gray-700/60"
                  style={{
                    top: `${(i / SLAT_COUNT) * 100}%`,
                    height: `${100 / SLAT_COUNT}%`,
                  }}
                />
              ))}

              {/* Shade panel — covers from top down */}
              <div
                className="absolute inset-x-0 top-0 bg-gray-500/80"
                style={{ height: `${shadeHeightPct}%` }}
                aria-hidden="true"
              />

              {/* Drag handle at shade boundary */}
              {shadeHeightPct < 100 && shadeHeightPct > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center"
                  style={{ top: `${shadeHeightPct}%`, transform: "translateY(-50%)" }}
                  aria-hidden="true"
                >
                  <div className="h-0.5 w-full bg-sky-400/80 shadow-[0_0_4px_1px_rgba(56,189,248,0.6)]" />
                  <div className="absolute h-3 w-6 rounded-sm bg-sky-400 shadow-md" />
                </div>
              )}
            </div>

            <p className="text-[11px] text-gray-500">Drag to set position</p>
          </div>
        </div>

        {/* Entity list */}
        <div className="mt-4 px-6">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-600">
            Included blinds
          </p>
          <div className="flex flex-col gap-1">
            {groupEntityIds.map((id) => (
              <p key={id} className="truncate text-[11px] text-gray-500">
                {id}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ─── Quick action button ──────────────────────────────────────────────────────

function QuickButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-14 items-center justify-center rounded-lg bg-white/10 text-sm font-medium text-white/80 transition-transform hover:bg-white/20 active:scale-95 disabled:opacity-40"
    >
      {label}
    </button>
  );
}
