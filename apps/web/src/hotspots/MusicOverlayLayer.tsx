import { useState } from "react";
import type { MusicConfig, MusicSpeaker } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { type ImageFitBounds, FULL_BOUNDS } from "./useImageFitBounds.ts";
import { useMusicStore } from "../store/music.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { useToastStore } from "../store/toast.ts";
import { api } from "../api/client.ts";
import { ICON_PATHS } from "./icons.ts";
import { MusicArt } from "./MusicArt.tsx";
import { MusicControlDialog } from "./MusicControlDialog.tsx";

interface MusicOverlayLayerProps {
  hotspots: HotspotRaw[];
  /** Bounds of the rendered image within the container (fractions 0–1). */
  imageBounds?: ImageFitBounds;
}

/**
 * Overlay that renders a now-playing card per speaker when a music hotspot
 * is expanded (clicked). Cards are anchored directly at each speaker's
 * configured position (like PowerpointOverlayLayer's pins) rather than with
 * leader-line routing to a separate callout position, so no collision
 * avoidance is needed — crowded speakers are spaced apart during placement.
 * Tapping a card opens MusicControlDialog for bigger controls.
 */
export function MusicOverlayLayer({ hotspots, imageBounds = FULL_BOUNDS }: MusicOverlayLayerProps) {
  const visibleHotspotId = useMusicStore((s) => s.visibleHotspotId);
  const triggeredByZIndex = useMusicStore((s) => s.triggeredByZIndex);
  const hide = useMusicStore((s) => s.hide);

  const [openItemId, setOpenItemId] = useState<string | null>(null);

  if (!visibleHotspotId) return null;

  const hotspot = hotspots.find((h) => h.id === visibleHotspotId && h.type === "music");
  if (!hotspot) return null;

  const config = hotspot.configJson as unknown as MusicConfig;
  const items = config.items ?? [];
  const openItem = items.find((it) => it.id === openItemId) ?? null;

  return (
    <>
      <div
        className="pointer-events-auto absolute inset-0"
        // Cards show live info for every speaker at once, so this must render
        // above every other hotspot on the canvas regardless of the trigger
        // icon's own z-index — otherwise any hotspot placed nearby with a
        // higher z-index (e.g. a light icon) paints through the cards.
        style={{ zIndex: triggeredByZIndex + 1000 }}
        onClick={() => {
          hide();
          setOpenItemId(null);
        }}
        aria-label="Music overlay — click to dismiss"
      >
        <div
          style={{
            position: "absolute",
            left: `${imageBounds.x * 100}%`,
            top: `${imageBounds.y * 100}%`,
            width: `${imageBounds.width * 100}%`,
            height: `${imageBounds.height * 100}%`,
          }}
          // No stopPropagation here (unlike the powerpoint/battery layers this was
          // modeled on) — this div exists only to position cards relative to the
          // image, not to catch clicks. It must let clicks on empty floorplan space
          // (which is most of this div's area, including wherever other hotspots
          // visually sit, since they render beneath this overlay) bubble up to the
          // backdrop's dismiss handler below. Only SpeakerCard itself stops
          // propagation, so tapping a card still opens it instead of dismissing.
        >
          {items.map((item) => (
            <SpeakerCard key={item.id} item={item} onOpen={() => setOpenItemId(item.id)} />
          ))}
        </div>
      </div>

      {openItem && (
        <MusicControlDialog
          // Remounts the dialog when switching speakers (e.g. after a transfer), so
          // it always opens fresh on the "main" view rather than carrying over
          // whatever sub-view the previous speaker's dialog happened to be on.
          key={openItem.id}
          item={openItem}
          allSpeakers={items}
          onSwitchSpeaker={(id) => setOpenItemId(id)}
          onClose={() => setOpenItemId(null)}
        />
      )}
    </>
  );
}

// ─── Speaker card ───────────────────────────────────────────────────────────

interface SpeakerCardProps {
  item: MusicSpeaker;
  onOpen: () => void;
}

function SpeakerCard({ item, onOpen }: SpeakerCardProps) {
  const entityState = useEntityStateStore((s) => (item.entityId ? s.getState(item.entityId) : undefined));
  const addToast = useToastStore((s) => s.addToast);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [localVolume, setLocalVolume] = useState(0);
  const [isPending, setIsPending] = useState(false);

  const state = entityState?.state ?? "unavailable";
  const isPlaying = state === "playing";
  const title = typeof entityState?.attributes?.media_title === "string" ? entityState.attributes.media_title : null;
  const artist = typeof entityState?.attributes?.media_artist === "string" ? entityState.attributes.media_artist : null;
  const entityPicture = entityState?.attributes?.entity_picture;
  const artUrl =
    item.entityId && typeof entityPicture === "string" && entityPicture ? api.ha.mediaImageUrl(item.entityId) : null;

  const haVolume =
    typeof entityState?.attributes?.volume_level === "number"
      ? Math.round(entityState.attributes.volume_level * 100)
      : 0;
  const volume = isDraggingVolume ? localVolume : haVolume;

  const call = async (service: string, serviceData?: Record<string, unknown>) => {
    if (!item.entityId || isPending) return;
    setIsPending(true);
    try {
      await api.ha.callService("media_player", service, { serviceData, target: { entityId: item.entityId } });
    } catch (err) {
      addToast(`${item.name} control failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsPending(false);
    }
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        stop(e);
        onOpen();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          stop(e);
          onOpen();
        }
      }}
      className="absolute flex w-[168px] -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col gap-1.5 rounded-xl border border-white/10 bg-black/80 p-2.5 shadow-xl backdrop-blur-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
    >
      <div className="flex items-center gap-2">
        <MusicArt
          src={artUrl}
          sizeClass="h-9 w-9"
          fallback={
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d={ICON_PATHS["mdi:speaker"]} fill="#9ca3af" />
              </svg>
            </div>
          }
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-white">{item.name}</p>
          <p className="truncate text-[10px] text-gray-400">
            {title ?? (state === "unavailable" ? "Unavailable" : "Idle")}
          </p>
          {artist && <p className="truncate text-[9px] text-gray-500">{artist}</p>}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Previous track"
          disabled={isPending}
          onClick={(e) => {
            stop(e);
            void call("media_previous_track");
          }}
          className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path d={ICON_PATHS["mdi:skip-previous"]} fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          disabled={isPending}
          onClick={(e) => {
            stop(e);
            void call("media_play_pause");
          }}
          className="rounded-full bg-white/10 p-1.5 text-white hover:bg-white/20 disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" className={["h-4 w-4", isPending ? "animate-pulse" : ""].join(" ")}>
            <path d={ICON_PATHS[isPlaying ? "mdi:pause" : "mdi:play"]} fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Next track"
          disabled={isPending}
          onClick={(e) => {
            stop(e);
            void call("media_next_track");
          }}
          className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4">
            <path d={ICON_PATHS["mdi:skip-next"]} fill="currentColor" />
          </svg>
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={volume}
        aria-label={`${item.name} volume`}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-accent"
        onClick={stop}
        onPointerDown={(e) => {
          stop(e);
          setLocalVolume(haVolume);
          setIsDraggingVolume(true);
        }}
        onChange={(e) => setLocalVolume(Number(e.target.value))}
        onPointerUp={(e) => {
          stop(e);
          setIsDraggingVolume(false);
          void call("volume_set", { volume_level: Number((e.target as HTMLInputElement).value) / 100 });
        }}
      />
    </div>
  );
}
