import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useStateStream } from "../hooks/use-state-stream.ts";
import { useInactivity } from "../hooks/use-inactivity.ts";
import { useSolarImage } from "../hooks/use-solar-image.ts";
import { ConnectionStatus } from "../components/ConnectionStatus.tsx";
import { ScreensaverOverlay } from "../components/ScreensaverOverlay.tsx";
import { KioskPinOverlay } from "../components/KioskPinOverlay.tsx";
import { HotspotLayer } from "../hotspots/HotspotLayer.tsx";
import { HeatmapLayer } from "../hotspots/HeatmapLayer.tsx";
import { BatteryOverlayLayer } from "../hotspots/BatteryOverlayLayer.tsx";
import { useImageFitBounds } from "../hotspots/useImageFitBounds.ts";
// Side-effect: ensure built-in hotspot types are registered
import "../hotspots/registry.ts";
import { api } from "../api/client.ts";
import type { CycleImages } from "@floorplan-ha/shared";
import type { FloorplanWithHotspotsRaw } from "../hotspots/types.ts";

/**
 * Presentation mode: full-screen floorplan with live hotspot overlay.
 * Designed for wall-mounted iPads and kiosk displays.
 */
export default function DashboardPage() {
  // Open SSE stream for live entity state updates
  useStateStream();

  const navigate = useNavigate();
  const [showPinOverlay, setShowPinOverlay] = useState(false);

  // Inactivity screensaver (default 5 min; configurable via settings)
  const { isIdle, resetIdle } = useInactivity(5 * 60 * 1000);

  // Load kiosk PIN setting from app settings
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.list(),
    staleTime: 60 * 1000,
  });
  const kioskPin = settings?.["kiosk_pin"] as string | null ?? null;

  const { data: floorplan, isLoading, error } = useQuery({
    queryKey: ["default-floorplan"],
    queryFn: fetchDefaultFloorplan,
    // Refetch silently every 5 minutes to pick up config changes
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !floorplan) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-surface text-gray-400">
        <p className="text-lg">No floorplan configured</p>
        <p className="text-sm">Add a floorplan in admin mode</p>
      </div>
    );
  }

  const handleAdminAccess = () => {
    if (kioskPin) {
      setShowPinOverlay(true);
    } else {
      navigate("/admin");
    }
  };

  return (
    <div
      className="relative flex h-screen w-screen items-center justify-center overflow-hidden"
      style={{ backgroundColor: floorplan.backgroundColor }}
    >
      <FloorplanCanvas floorplan={floorplan} />
      <ConnectionStatus />

      {/* Subtle admin access button — bottom-right corner */}
      <button
        type="button"
        onClick={handleAdminAccess}
        className="absolute bottom-2 right-2 z-10 rounded p-1.5 text-[10px] text-white/10 hover:text-white/40 transition-colors"
        aria-label="Admin access"
      >
        ⚙
      </button>

      {isIdle && <ScreensaverOverlay onDismiss={resetIdle} />}

      {showPinOverlay && (
        <KioskPinOverlay
          correctPin={kioskPin}
          onUnlock={() => {
            setShowPinOverlay(false);
            navigate("/admin");
          }}
          onDismiss={() => setShowPinOverlay(false)}
        />
      )}
    </div>
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchDefaultFloorplan(): Promise<FloorplanWithHotspotsRaw | null> {
  const dashboard = await api.dashboards.getDefault() as { id: string };
  const floorplans = await api.floorplans.list(dashboard.id) as { id: string }[];
  const first = floorplans[0];
  if (!first) return null;
  // Fetch the full floorplan, which includes hotspots + state rules
  return api.floorplans.get(first.id) as Promise<FloorplanWithHotspotsRaw>;
}

// ─── Floorplan Canvas ─────────────────────────────────────────────────────────

function FloorplanCanvas({ floorplan }: { floorplan: FloorplanWithHotspotsRaw }) {
  // Resolve cycle images: the JSON column may be an empty object {} when unset
  const cycleImages = (
    floorplan.imageMode === "day_night_cycle" &&
    floorplan.cycleImagesJson &&
    "day" in floorplan.cycleImagesJson
      ? floorplan.cycleImagesJson as CycleImages
      : null
  );
  const cycleAssetId = useSolarImage(cycleImages);

  const imageUrl =
    floorplan.imageMode === "single" && floorplan.imageAssetId
      ? api.assets.fileUrl(floorplan.imageAssetId)
      : floorplan.imageMode === "day_night_cycle" && cycleAssetId
        ? api.assets.fileUrl(cycleAssetId)
        : null;

  const hasValidDimensions = floorplan.width > 0 && floorplan.height > 0;
  const aspectRatio = hasValidDimensions
    ? `${floorplan.width} / ${floorplan.height}`
    : "16 / 9";

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageBounds = useImageFitBounds(containerRef, imageRef, floorplan.imageStretch ?? false);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        aspectRatio,
        width: "100%",
        maxWidth: "100%",
        maxHeight: "100%",
        // Use safe-area insets for iPad notch/home bar
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      {imageUrl ? (
        <img
          ref={imageRef}
          src={imageUrl}
          alt={floorplan.name}
          className={`absolute inset-0 h-full w-full select-none ${floorplan.imageStretch ? "object-fill" : "object-contain"}`}
          draggable={false}
          decoding="async"
          loading="eager"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-40" fill="none" viewBox="0 0 32 32">
            <rect x="4" y="5" width="23" height="21" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <line x1="16" y1="5" x2="16" y2="18" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="16" y1="18" x2="27" y2="18" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="22" cy="11" r="2.5" fill="currentColor" opacity="0.6"/>
          </svg>
          <p className="text-sm font-medium">No floorplan image</p>
          <p className="text-xs text-gray-500">Upload an image in Assets, then assign it via the floorplan Edit dialog</p>
        </div>
      )}

      <HeatmapLayer
        hotspots={floorplan.hotspots}
        maskAssetId={floorplan.heatmapMaskAssetId ?? null}
        imageBounds={imageBounds}
      />
      <BatteryOverlayLayer hotspots={floorplan.hotspots} imageBounds={imageBounds} />
      <HotspotLayer hotspots={floorplan.hotspots} imageBounds={imageBounds} />
    </div>
  );
}
