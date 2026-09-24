import type { MusicConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";
import { useMusicStore } from "../../store/music.ts";
import { api } from "../../api/client.ts";
import { MusicArt } from "../MusicArt.tsx";

/**
 * Music Assistant overview hotspot.
 *
 * Renders a single speaker icon. When any configured speaker is currently
 * playing, shows that speaker's album art (falling back to a highlighted
 * speaker glyph when there's no art) so the icon reflects what's playing
 * without needing to open the overlay.
 *
 * Clicking the icon toggles a floorplan overlay (MusicOverlayLayer) that
 * shows each individual speaker's now-playing card, which can then be
 * tapped to open a bigger control dialog.
 */
export function MusicHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as unknown as MusicConfig;
  const items = config.items ?? [];

  const getEntityState = useEntityStateStore((s) => s.getState);
  const visibleHotspotId = useMusicStore((s) => s.visibleHotspotId);
  const toggle = useMusicStore((s) => s.toggle);

  const isExpanded = visibleHotspotId === hotspot.id;

  const activeItem = items.find((item) => item.entityId && getEntityState(item.entityId)?.state === "playing");
  const activeState = activeItem?.entityId ? getEntityState(activeItem.entityId) : undefined;
  const entityPicture = activeState?.attributes?.entity_picture;
  const artUrl =
    activeItem?.entityId && typeof entityPicture === "string" && entityPicture
      ? api.ha.mediaImageUrl(activeItem.entityId)
      : null;

  const configBg = config.backgroundColor ?? null;
  const resolvedBg =
    configBg === "transparent"
      ? "transparent"
      : configBg != null
        ? configBg
        : isExpanded
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.08)";

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode) return;
    e.stopPropagation();
    toggle(hotspot.id, hotspot.zIndex);
  };

  return (
    <button
      type="button"
      aria-label={`${hotspot.name}${activeItem ? " — music playing" : ""} — click to ${isExpanded ? "hide" : "show"} speakers`}
      disabled={isEditMode}
      onClick={handleClick}
      className={[
        "relative flex h-full w-full select-none flex-col items-center justify-center gap-0.5 rounded-lg",
        "min-h-[44px] min-w-[44px] transition-all duration-100",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        isEditMode ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: resolvedBg,
        boxShadow: isExpanded ? "0 0 10px 3px rgba(250,204,21,0.35)" : undefined,
      }}
    >
      <span className="relative inline-block">
        <MusicArt
          src={artUrl}
          sizeClass="h-16 w-16"
          fallback={
            // Rendered larger than the hotspot's own bounding box (which stays at its
            // configured size — see min-h/min-w on the button) so the icon reads clearly
            // on the floorplan without needing a bigger click target underneath it.
            <img src="/music-icon.png" alt="" className="h-16 w-16 shrink-0 object-contain" draggable={false} />
          }
        />
        {/* Playing indicator — visible even when the overlay is dismissed and the
            active speaker happens to have no album art (so the icon alone would
            otherwise look identical to the "nothing playing" idle state). */}
        {activeItem && (
          <span
            className="absolute right-0.5 top-0.5 h-3 w-3 animate-pulse rounded-full border border-black/40 bg-green-500"
            aria-hidden="true"
          />
        )}
      </span>
      {items.length > 0 && <span className="text-[10px] tabular-nums text-gray-300">{items.length}</span>}
    </button>
  );
}
