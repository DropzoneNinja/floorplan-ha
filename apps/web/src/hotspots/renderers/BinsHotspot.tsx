import { useCallback, useEffect, useState } from "react";
import type { BinsConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { api } from "../../api/client.ts";

type BinType = "yellow" | "red" | null;

interface BinState {
  bin: BinType;
  /** ISO date string of the event start (YYYY-MM-DD) */
  eventDate: string | null;
}

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/** Returns "today", "tomorrow", or null for any other date. */
function dayLabel(eventDate: string | null): "today" | "tomorrow" | null {
  if (!eventDate) return null;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  if (eventDate === today) return "today";
  if (eventDate === tomorrow) return "tomorrow";
  return null;
}

/**
 * Bins hotspot: reads a Home Assistant calendar entity and displays either a
 * yellow or red bin image based on which bin day is coming up next.
 *
 * Calendar events named "Yellow Bin" or "Red Bin" (case-insensitive) are matched.
 * Shows "today" or "tomorrow" beneath the image when the event is within the next day.
 * The result is refreshed at the start of each new day.
 */
export function BinsHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as BinsConfig;
  const entityId = hotspot.entityId;

  const [binState, setBinState] = useState<BinState>({ bin: null, eventDate: null });
  const [loading, setLoading] = useState(true);

  const fetchNextBin = useCallback(async () => {
    if (!entityId) {
      setLoading(false);
      return;
    }
    try {
      const events = await api.ha.calendarEvents(entityId, 30);
      const match = events.find(
        (e) => /yellow bin/i.test(e.summary) || /red bin/i.test(e.summary),
      );
      if (!match) {
        setBinState({ bin: null, eventDate: null });
      } else {
        const eventDate = (match.start.date ?? match.start.dateTime ?? "").slice(0, 10);
        setBinState({
          bin: /yellow bin/i.test(match.summary) ? "yellow" : "red",
          eventDate: eventDate || null,
        });
      }
    } catch {
      setBinState({ bin: null, eventDate: null });
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchNextBin();

    // Refresh at midnight, then every 24 hours thereafter
    let intervalId: ReturnType<typeof setInterval>;
    const timerId = setTimeout(() => {
      fetchNextBin();
      intervalId = setInterval(fetchNextBin, 24 * 60 * 60 * 1000);
    }, msUntilMidnight());

    return () => {
      clearTimeout(timerId);
      clearInterval(intervalId);
    };
  }, [fetchNextBin]);

  const assetId =
    binState.bin === "yellow"
      ? config.yellowBinAssetId
      : binState.bin === "red"
        ? config.redBinAssetId
        : null;

  // Edit mode: show whichever image is configured (yellow preferred), or placeholder
  const displayAssetId = isEditMode ? (config.yellowBinAssetId ?? config.redBinAssetId) : assetId;
  const label = isEditMode ? "tomorrow" : dayLabel(binState.eventDate);

  if (!config.yellowBinAssetId && !config.redBinAssetId) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-white/20">
        <span className="text-[10px] text-gray-500">No images configured</span>
      </div>
    );
  }

  if (!isEditMode && loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="text-[10px] text-gray-400">…</span>
      </div>
    );
  }

  if (!displayAssetId) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-white/20">
        <span className="text-[10px] text-gray-500">No bin day found</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center" aria-label={hotspot.name}>
      <div className={`relative w-full ${label ? "h-[80%]" : "h-full"}`}>
        <img
          src={api.assets.fileUrl(displayAssetId)}
          alt={hotspot.name}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
      </div>
      {label && (
        <span className="text-center text-[11px] font-medium leading-tight text-white drop-shadow">
          {label}
        </span>
      )}
    </div>
  );
}
