import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { MusicSpeaker } from "@floorplan-ha/shared";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { ICON_PATHS } from "./icons.ts";
import { MusicArt } from "./MusicArt.tsx";
import { MusicBrowseView } from "./MusicBrowseView.tsx";
import { MusicQueueView } from "./MusicQueueView.tsx";
import { MusicMoveView } from "./MusicMoveView.tsx";

type DialogView = "main" | "browse" | "queue" | "move";

const VIEW_TITLES: Record<Exclude<DialogView, "main">, string> = {
  browse: "Browse library",
  queue: "Queue",
  move: "Move / group",
};

interface MusicControlDialogProps {
  item: MusicSpeaker;
  /** Every speaker configured on this hotspot, including `item` itself — used by the move/group view. */
  allSpeakers: MusicSpeaker[];
  /** Switch straight to a different speaker's dialog (e.g. after transferring playback to it). */
  onSwitchSpeaker: (speakerId: string) => void;
  onClose: () => void;
}

/**
 * Dialog opened by tapping a speaker card on the floorplan. The main view has
 * transport/volume controls plus entry points into three sub-views: browsing
 * the Music Assistant library (with search), the play queue, and moving or
 * grouping playback with other configured speakers.
 */
export function MusicControlDialog({ item, allSpeakers, onSwitchSpeaker, onClose }: MusicControlDialogProps) {
  const [view, setView] = useState<DialogView>("main");
  const addToast = useToastStore((s) => s.addToast);
  const entityId = item.entityId ?? "";
  const entityState = useEntityStateStore((s) => (item.entityId ? s.getState(item.entityId) : undefined));

  // Detect whether this entity is actually a Music Assistant player (vs. e.g. the
  // native Sonos/Cast entity for the same physical speaker). Music Assistant's own
  // browse root always reports media_content_type "music_assistant"; anything else
  // means Browse/Search/Queue/Move will misbehave or fail outright against it, so
  // this is surfaced as a persistent banner rather than left for the user to
  // discover as a string of silent-looking failures.
  const rootCheck = useQuery({
    queryKey: ["music-root-check", entityId],
    queryFn: () => api.ha.browseMedia(entityId),
    enabled: entityId !== "",
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const maCheckDone = rootCheck.isSuccess || rootCheck.isError;
  const isMusicAssistantPlayer = rootCheck.data?.media_content_type === "music_assistant";

  const state = entityState?.state ?? "unavailable";
  const isPlaying = state === "playing";
  const title = typeof entityState?.attributes?.media_title === "string" ? entityState.attributes.media_title : null;
  const artist = typeof entityState?.attributes?.media_artist === "string" ? entityState.attributes.media_artist : null;
  const albumName =
    typeof entityState?.attributes?.media_album_name === "string" ? entityState.attributes.media_album_name : null;
  const entityPicture = entityState?.attributes?.entity_picture;
  const artUrl =
    item.entityId && typeof entityPicture === "string" && entityPicture ? api.ha.mediaImageUrl(item.entityId) : null;

  const haVolume =
    typeof entityState?.attributes?.volume_level === "number"
      ? Math.round(entityState.attributes.volume_level * 100)
      : 0;
  const [localVolume, setLocalVolume] = useState(haVolume);
  const isDraggingVolume = useRef(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!isDraggingVolume.current) setLocalVolume(haVolume);
  }, [haVolume]);

  const call = async (service: string, serviceData?: Record<string, unknown>) => {
    if (!entityId || isPending) return;
    setIsPending(true);
    try {
      await api.ha.callService("media_player", service, { serviceData, target: { entityId } });
    } catch (err) {
      addToast(
        `${item.name} control failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setIsPending(false);
    }
  };

  const otherSpeakers = allSpeakers.filter((s) => s.id !== item.id);
  const hasEntity = !!item.entityId;

  const modal = (
    <div
      className="fixed inset-0 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      // MusicOverlayLayer's backdrop (the speaker cards behind this dialog) sits at
      // triggeredByZIndex + 1000 so it can beat other in-canvas hotspots — this modal
      // must always beat *that*, so it needs more headroom than the codebase's usual
      // z-50 modal convention (fine for other dialogs, since none of them compete with
      // an elevated in-canvas overlay like this one does).
      style={{ zIndex: 5000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-surface-raised pb-6 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {view !== "main" && (
              <button
                type="button"
                onClick={() => setView("main")}
                aria-label="Back"
                className="shrink-0 rounded-full px-1 text-[22px] leading-none text-gray-400 hover:text-white"
              >
                ←
              </button>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-[21px] font-semibold text-white">
                {view === "main" ? item.name : VIEW_TITLES[view]}
              </h2>
              {view === "main" && entityId && <p className="mt-0.5 truncate text-base text-gray-500">{entityId}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {view === "main" && (
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-base font-medium capitalize",
                  isPlaying ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-400",
                ].join(" ")}
              >
                {state}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-[27px] leading-none text-gray-500 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {maCheckDone && !isMusicAssistantPlayer && (
          <div className="mx-5 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px] leading-snug text-amber-300">
            <strong className="font-semibold">Not linked to Music Assistant.</strong> {entityId} is browsing its
            own native menu instead of your Music Assistant library — Search, Queue, and Move/Group won't work
            here. Rebind this speaker to its Music-Assistant-provided entity in the hotspot's Actions tab (it's
            usually a differently-numbered entity with the same room name).
          </div>
        )}

        <div className="px-5 pt-5">
          {view === "main" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <MusicArt
                  src={artUrl}
                  sizeClass="h-16 w-16"
                  roundedClass="rounded-lg"
                  fallback={
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
                        <path d={ICON_PATHS["mdi:speaker"]} fill="#9ca3af" />
                      </svg>
                    </div>
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium text-white">{title ?? "Nothing playing"}</p>
                  {artist && <p className="truncate text-base text-gray-400">{artist}</p>}
                  {albumName && <p className="truncate text-sm text-gray-500">{albumName}</p>}
                </div>
              </div>

              <div className="flex items-center justify-center gap-6">
                <button
                  type="button"
                  aria-label="Previous track"
                  disabled={isPending}
                  onClick={() => void call("media_previous_track")}
                  className="rounded-full p-3 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6">
                    <path d={ICON_PATHS["mdi:skip-previous"]} fill="currentColor" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label={isPlaying ? "Pause" : "Play"}
                  disabled={isPending}
                  onClick={() => void call("media_play_pause")}
                  className="rounded-full bg-white/10 p-4 text-white hover:bg-white/20 disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7">
                    <path d={ICON_PATHS[isPlaying ? "mdi:pause" : "mdi:play"]} fill="currentColor" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Next track"
                  disabled={isPending}
                  onClick={() => void call("media_next_track")}
                  className="rounded-full p-3 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6">
                    <path d={ICON_PATHS["mdi:skip-next"]} fill="currentColor" />
                  </svg>
                </button>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-base font-medium text-gray-400">Volume</p>
                  <span className="text-base tabular-nums text-gray-400">{localVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={localVolume}
                  aria-label="Volume"
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-accent"
                  onPointerDown={() => {
                    isDraggingVolume.current = true;
                  }}
                  onChange={(e) => setLocalVolume(Number(e.target.value))}
                  onPointerUp={(e) => {
                    isDraggingVolume.current = false;
                    void call("volume_set", { volume_level: Number((e.target as HTMLInputElement).value) / 100 });
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={!hasEntity}
                  onClick={() => setView("browse")}
                  className="rounded-lg bg-white/10 py-2 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
                >
                  Browse
                </button>
                <button
                  type="button"
                  disabled={!hasEntity}
                  onClick={() => setView("queue")}
                  className="rounded-lg bg-white/10 py-2 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
                >
                  Queue
                </button>
                <button
                  type="button"
                  disabled={!hasEntity || otherSpeakers.length === 0}
                  onClick={() => setView("move")}
                  className="rounded-lg bg-white/10 py-2 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-40"
                >
                  Move
                </button>
              </div>
            </div>
          )}

          {view === "browse" && hasEntity && <MusicBrowseView entityId={item.entityId!} onPlayed={() => setView("main")} />}
          {view === "queue" && hasEntity && <MusicQueueView entityId={item.entityId!} />}
          {view === "move" && (
            <MusicMoveView
              current={item}
              otherSpeakers={otherSpeakers}
              onTransferred={onSwitchSpeaker}
              onDone={() => setView("main")}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
