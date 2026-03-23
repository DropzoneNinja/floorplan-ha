import type { HotspotRaw } from "./types.ts";
import { HotspotRenderer } from "./HotspotRenderer.tsx";
import type { ImageFitBounds } from "./useImageFitBounds.ts";
import { FULL_BOUNDS } from "./useImageFitBounds.ts";

interface HotspotLayerProps {
  hotspots: HotspotRaw[];
  isEditMode?: boolean;
  /** Bounds of the rendered image within the container (fractions 0–1). Defaults to full container. */
  imageBounds?: ImageFitBounds;
}

/**
 * Overlay layer that renders all hotspots over the floorplan image.
 *
 * Hotspot positions are stored as normalized 0–1 fractions of the image area.
 * The inner sub-div is sized and offset to match the actual rendered image
 * bounds (accounting for object-contain letterboxing/pillarboxing), so
 * hotspot percentages are always relative to the image, not the container.
 */
export function HotspotLayer({ hotspots, isEditMode = false, imageBounds = FULL_BOUNDS }: HotspotLayerProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-label="Hotspot overlay"
    >
      <div
        style={{
          position: "absolute",
          left: `${imageBounds.x * 100}%`,
          top: `${imageBounds.y * 100}%`,
          width: `${imageBounds.width * 100}%`,
          height: `${imageBounds.height * 100}%`,
        }}
      >
        {hotspots.map((hotspot) => (
          <HotspotItem key={hotspot.id} hotspot={hotspot} isEditMode={isEditMode} />
        ))}
      </div>
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
