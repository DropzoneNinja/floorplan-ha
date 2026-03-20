import type { HotspotRaw } from "./types.ts";
import { HotspotRenderer } from "./HotspotRenderer.tsx";

interface HotspotLayerProps {
  hotspots: HotspotRaw[];
  isEditMode?: boolean;
}

/**
 * Overlay layer that renders all hotspots over the floorplan image.
 *
 * Hotspot positions are stored as normalized 0–1 fractions of the floorplan
 * dimensions. This layer must be placed inside a container that matches the
 * floorplan's intrinsic aspect ratio so percentages translate correctly.
 */
export function HotspotLayer({ hotspots, isEditMode = false }: HotspotLayerProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-label="Hotspot overlay"
    >
      {hotspots.map((hotspot) => (
        <HotspotItem key={hotspot.id} hotspot={hotspot} isEditMode={isEditMode} />
      ))}
    </div>
  );
}

function HotspotItem({
  hotspot,
  isEditMode,
}: {
  hotspot: HotspotRaw;
  isEditMode?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: `${hotspot.x * 100}%`,
        top: `${hotspot.y * 100}%`,
        width: `${hotspot.width * 100}%`,
        height: `${hotspot.height * 100}%`,
        transform: hotspot.rotation !== 0 ? `rotate(${hotspot.rotation}deg)` : undefined,
        zIndex: hotspot.zIndex,
        // Re-enable pointer events per-hotspot (parent is pointer-events-none)
        pointerEvents: "auto",
      }}
      aria-label={hotspot.name}
    >
      <HotspotRenderer hotspot={hotspot} isEditMode={isEditMode ?? false} />
    </div>
  );
}
