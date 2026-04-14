import { useCallback, useEffect, useState } from "react";
import type { BurnOffConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { api } from "../../api/client.ts";
import { BurnOffScheduleModal } from "../../components/BurnOffScheduleModal.tsx";

/** Returns a local YYYY-MM-DD string (not UTC) for the given date. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/**
 * Returns true if the given YYYY-MM-DD date string falls within the given
 * closed [from, to] range (inclusive, lexicographic comparison is safe for
 * ISO dates).
 */
function isInNoBurnPeriod(
  dateStr: string,
  periods: Array<{ from: string; to: string }>,
): boolean {
  return periods.some((p) => dateStr >= p.from && dateStr <= p.to);
}

/**
 * BurnOff hotspot: displays images based on the current burn-off status.
 *
 * Display priority (highest to lowest):
 *  1. Total Fire Ban active → show the fire ban image (overrides everything).
 *  2. Burn day (not in a no-burn period AND day is in allowedDays) → show burn-off image.
 *  3. Not a burn day → show the no-burn-day image (if configured).
 *
 * In edit mode, always shows the burn-off image (and fireban hint if
 * fireBanAssetId is set, to allow visual preview).
 */
export function BurnOffHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as BurnOffConfig;

  const [totalFireban, setTotalFireban] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Force a re-render at midnight so burn-day logic re-evaluates
  const [, setTick] = useState(0);

  const fetchFirebanStatus = useCallback(async () => {
    try {
      const status = await api.fireban.status();
      setTotalFireban(status.totalFireban);
    } catch {
      // Leave current state unchanged on error
    }
  }, []);

  useEffect(() => {
    fetchFirebanStatus();

    // Poll every 30 minutes for fireban status updates
    const pollInterval = setInterval(fetchFirebanStatus, 30 * 60 * 1000);

    // Refresh burn-day logic at midnight, then every 24 h
    let dailyInterval: ReturnType<typeof setInterval>;
    const midnightTimer = setTimeout(() => {
      setTick((t) => t + 1);
      fetchFirebanStatus();
      dailyInterval = setInterval(() => {
        setTick((t) => t + 1);
        fetchFirebanStatus();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight());

    return () => {
      clearInterval(pollInterval);
      clearTimeout(midnightTimer);
      clearInterval(dailyInterval);
    };
  }, [fetchFirebanStatus]);

  const today = new Date();
  const todayStr = localDateStr(today);
  const dayOfWeek = today.getDay(); // 0 = Sunday

  const inNoBurnPeriod = isInNoBurnPeriod(todayStr, config.noBurnPeriods ?? []);
  const isBurnDay =
    !inNoBurnPeriod && (config.allowedDays ?? []).includes(dayOfWeek);

  // Nothing configured yet
  if (!config.burnOffAssetId && !config.noBurnDayAssetId && !config.fireBanAssetId) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-white/20">
        <span className="text-[10px] text-gray-500">No images configured</span>
      </div>
    );
  }

  // Determine which image to show in view mode (priority order)
  let viewAssetId: string | null = null;
  let viewAlt = hotspot.name;
  if (totalFireban && config.fireBanAssetId) {
    viewAssetId = config.fireBanAssetId;
    viewAlt = "Total Fire Ban";
  } else if (isBurnDay && config.burnOffAssetId) {
    viewAssetId = config.burnOffAssetId;
  } else if (!isBurnDay && config.noBurnDayAssetId) {
    viewAssetId = config.noBurnDayAssetId;
  }

  // In edit mode always show the burn-off image regardless of day/schedule
  const editAssetId = config.burnOffAssetId;

  const displayAssetId = isEditMode ? editAssetId : viewAssetId;

  // Nothing to show
  if (!displayAssetId) {
    return <div className="h-full w-full" />;
  }

  return (
    <>
      <div
        className={[
          "relative h-full w-full",
          !isEditMode ? "cursor-pointer" : "",
        ].join(" ")}
        aria-label={hotspot.name}
        onClick={!isEditMode ? () => setModalOpen(true) : undefined}
      >
        <img
          src={api.assets.fileUrl(displayAssetId)}
          alt={isEditMode ? hotspot.name : viewAlt}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {/* Edit-mode hint when fireban image is configured but not active */}
        {isEditMode && config.fireBanAssetId && !totalFireban && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center bg-black/40 py-0.5">
            <span className="text-[9px] text-amber-300">Fire ban overlay ready</span>
          </div>
        )}
      </div>

      {modalOpen && (
        <BurnOffScheduleModal
          config={config}
          totalFireban={totalFireban}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
