import { useCallback, useEffect, useState } from "react";
import type { BurnOffConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { api } from "../../api/client.ts";

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
 * BurnOff hotspot: displays a fire image on days when burning is permitted,
 * and overlays a fire-ban image when CFA Victoria declares a Total Fire Ban
 * for the Central district.
 *
 * Display logic:
 *  1. If today falls in a configured no-burn period → nothing shown.
 *  2. If today's day-of-week is not in allowedDays → nothing shown.
 *  3. Otherwise show the burn-off image.
 *  4. If a Total Fire Ban is currently active → overlay the fireban image on top.
 *
 * In edit mode, always shows the burn-off image (and fireban overlay if
 * fireBanAssetId is set, to allow visual preview).
 */
export function BurnOffHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as BurnOffConfig;

  const [totalFireban, setTotalFireban] = useState(false);
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

  // In edit mode always show the burn-off image regardless of day/schedule
  const showBurnImage = isEditMode || isBurnDay;
  const showFireban = showBurnImage && totalFireban && !!config.fireBanAssetId;

  // Nothing configured yet
  if (!config.burnOffAssetId && !config.fireBanAssetId) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-white/20">
        <span className="text-[10px] text-gray-500">No images configured</span>
      </div>
    );
  }

  // Not a burn day and not edit mode — render nothing (transparent)
  if (!showBurnImage) {
    return <div className="h-full w-full" />;
  }

  return (
    <div className="relative h-full w-full" aria-label={hotspot.name}>
      {/* Burn-off image */}
      {config.burnOffAssetId && (
        <img
          src={api.assets.fileUrl(config.burnOffAssetId)}
          alt={hotspot.name}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
      )}

      {/* Total fire ban overlay — displayed on top of the burn-off image */}
      {showFireban && config.fireBanAssetId && (
        <img
          src={api.assets.fileUrl(config.fireBanAssetId)}
          alt="Total Fire Ban"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
      )}

      {/* Edit-mode hint when fireban image is configured but not active */}
      {isEditMode && config.fireBanAssetId && !totalFireban && (
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center bg-black/40 py-0.5">
          <span className="text-[9px] text-amber-300">Fire ban overlay ready</span>
        </div>
      )}
    </div>
  );
}
