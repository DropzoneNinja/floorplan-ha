import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MusicSpeaker } from "@floorplan-ha/shared";
import type { MusicLibraryMediaType } from "../api/client.ts";
import { api } from "../api/client.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { useToastStore } from "../store/toast.ts";
import { ICON_PATHS } from "./icons.ts";
import { MusicArt } from "./MusicArt.tsx";
import { useMusicQueue } from "./MusicQueueView.tsx";
import { sliderFillStyle } from "./slider-fill.ts";

type RepeatMode = "off" | "all" | "one";
const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = { off: "all", all: "one", one: "off" };

const ART_SIZE = "aspect-square w-[min(60vw,300px)] shrink-0 sm:w-[min(40vh,340px)]";

interface MusicNowPlayingProps {
  item: MusicSpeaker;
  /** Opens the right-hand browse panel, optionally straight into one library category. */
  onBrowse: (category?: MusicLibraryMediaType) => void;
  /** Opens the right-hand speakers panel (move / group). */
  onSpeakers: () => void;
}

/**
 * Left column of the music dialog: large album art, track metadata, a seekable
 * progress bar, shuffle/transport/repeat controls, volume, and shortcut chips
 * into the browse and speaker panels. Everything is driven by the speaker's
 * media_player entity state, so it updates live without polling.
 */
export function MusicNowPlaying({ item, onBrowse, onSpeakers }: MusicNowPlayingProps) {
  const entityId = item.entityId;
  const hasEntity = !!entityId;
  const entityState = useEntityStateStore((s) => (entityId ? s.getState(entityId) : undefined));
  const addToast = useToastStore((s) => s.addToast);
  const [isPending, setIsPending] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const queryClient = useQueryClient();

  // The track being played is the queue's current item; its URI identifies it to
  // Music Assistant. Favorite status comes from MA's own per-track lookup, not the
  // queue snapshot, which can disagree with the library.
  const { data: queue } = useMusicQueue(entityId ?? "");
  const queueItems = queue?.queue_items ?? [];
  const currentQueueItem =
    queueItems.find((i) => i.queue_item_id === queue?.current_item?.queue_item_id) ??
    queueItems[0] ??
    null;
  const mediaUri = currentQueueItem?.media_item?.uri ?? null;

  const favoriteKey = ["music-favorite", mediaUri];
  const { data: favoriteState, isPending: favoriteLoading } = useQuery({
    queryKey: favoriteKey,
    queryFn: () => api.music.isFavorite(mediaUri ?? ""),
    enabled: mediaUri !== null,
  });
  const isFavorite = favoriteState?.favorite === true;

  const toggleFavorite = async () => {
    if (!mediaUri || favoritePending || favoriteLoading) return;
    const next = !isFavorite;
    const previous = queryClient.getQueryData<{ favorite: boolean }>(favoriteKey);
    // Flip the heart immediately; the refetch below confirms it against Music Assistant.
    queryClient.setQueryData(favoriteKey, { favorite: next });
    setFavoritePending(true);
    try {
      await api.music.setFavorite(mediaUri, next);
      addToast(
        next
          ? `Added ${title ?? "track"} to favorites`
          : `Removed ${title ?? "track"} from favorites`,
        "success",
      );
    } catch (err) {
      queryClient.setQueryData(favoriteKey, previous);
      addToast(
        `Couldn't update favorite: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setFavoritePending(false);
      void queryClient.invalidateQueries({ queryKey: favoriteKey });
    }
  };

  const attrs = entityState?.attributes ?? {};
  const state = entityState?.state ?? "unavailable";
  const isPlaying = state === "playing";
  const title = str(attrs.media_title);
  const artist = str(attrs.media_artist);
  const album = str(attrs.media_album_name);
  const sourceName = sourceFromContentId(str(attrs.media_content_id));
  const artUrl = entityId && str(attrs.entity_picture) ? api.ha.mediaImageUrl(entityId) : null;
  const shuffle = attrs.shuffle === true;
  const repeat: RepeatMode =
    attrs.repeat === "all" || attrs.repeat === "one" ? attrs.repeat : "off";

  // Progress: HA reports the position as of media_position_updated_at, so while
  // playing we advance it locally. The 1s ticker only runs while playing.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isPlaying]);

  const duration = num(attrs.media_duration);
  const reportedPosition = num(attrs.media_position) ?? 0;
  const updatedAtMs = Date.parse(str(attrs.media_position_updated_at) ?? "");
  let elapsed = reportedPosition;
  if (isPlaying && Number.isFinite(updatedAtMs)) elapsed += (Date.now() - updatedAtMs) / 1000;
  if (duration != null) elapsed = Math.min(Math.max(elapsed, 0), duration);

  // While the user drags the progress bar, show their target instead of the live position.
  const [scrubSeconds, setScrubSeconds] = useState<number | null>(null);
  const shownElapsed = scrubSeconds ?? elapsed;
  const canSeek = hasEntity && duration != null && duration > 0;

  // Volume follows HA while idle, but holds the local value during a drag so the slider doesn't jump.
  const haVolume = Math.round((num(attrs.volume_level) ?? 0) * 100);
  const [localVolume, setLocalVolume] = useState(haVolume);
  const isDraggingVolume = useRef(false);
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

  const commitSeek = async (seconds: number) => {
    await call("media_seek", { seek_position: seconds });
    setScrubSeconds(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
        <MusicArt
          src={artUrl}
          sizeClass={ART_SIZE}
          roundedClass="rounded-2xl shadow-2xl"
          fallback={
            <div className={`${ART_SIZE} flex items-center justify-center rounded-2xl bg-white/10`}>
              <svg viewBox="0 0 24 24" className="h-1/3 w-1/3" aria-hidden="true">
                <path d={ICON_PATHS["mdi:music-note"]} fill="#9ca3af" />
              </svg>
            </div>
          }
        />

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {sourceName && (
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-gray-300">
                {sourceName}
              </span>
            )}
            <span
              className={[
                "rounded-full px-2.5 py-1 text-sm font-medium capitalize",
                isPlaying ? "bg-green-500/20 text-green-300" : "bg-gray-500/20 text-gray-400",
              ].join(" ")}
            >
              {state}
            </span>
          </div>
          <p className="mt-4 line-clamp-2 text-3xl font-semibold leading-tight text-white">
            {title ?? (state === "unavailable" ? "Unavailable" : "Nothing playing")}
          </p>
          {artist && <p className="mt-2 truncate text-xl text-gray-300">{artist}</p>}
          {album && <p className="mt-1 truncate text-base text-gray-500">{album}</p>}
        </div>
      </div>

      <div>
        <input
          type="range"
          min={0}
          max={duration ?? 0}
          step={1}
          value={Math.floor(shownElapsed)}
          disabled={!canSeek}
          aria-label="Track position"
          className="h-2 w-full cursor-pointer appearance-none rounded-full accent-accent disabled:cursor-default disabled:opacity-40"
          style={sliderFillStyle(Math.floor(shownElapsed), 0, duration ?? 0)}
          onPointerDown={() => {
            if (canSeek) setScrubSeconds(elapsed);
          }}
          onChange={(e) => setScrubSeconds(Number(e.target.value))}
          onPointerUp={(e) => {
            if (scrubSeconds != null) void commitSeek(Number((e.target as HTMLInputElement).value));
          }}
          onKeyUp={(e) => {
            if (scrubSeconds != null) void commitSeek(Number((e.target as HTMLInputElement).value));
          }}
        />
        <div className="mt-2 flex justify-between text-sm tabular-nums text-gray-400">
          <span>{formatTime(shownElapsed)}</span>
          <span>{duration != null ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={isFavorite}
          title={
            mediaUri
              ? undefined
              : "Favorites need Music Assistant direct access (MA_BASE_URL/MA_TOKEN)"
          }
          disabled={!mediaUri || favoritePending || favoriteLoading}
          onClick={() => void toggleFavorite()}
          className={[
            "rounded-full p-3 transition-colors hover:bg-white/10 disabled:opacity-40",
            isFavorite ? "text-rose-400" : "text-white/80 hover:text-white",
          ].join(" ")}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path
              d={ICON_PATHS[isFavorite ? "mdi:heart" : "mdi:heart-outline"]}
              fill="currentColor"
            />
          </svg>
        </button>
        <TransportButton
          icon="mdi:shuffle-variant"
          label={shuffle ? "Shuffle on" : "Shuffle off"}
          pressed={shuffle}
          disabled={!hasEntity || isPending}
          onClick={() => void call("shuffle_set", { shuffle: !shuffle })}
          size="small"
        />
        <TransportButton
          icon="mdi:skip-previous"
          label="Previous track"
          disabled={!hasEntity || isPending}
          onClick={() => void call("media_previous_track")}
        />
        <button
          type="button"
          aria-label={isPlaying ? "Pause" : "Play"}
          disabled={!hasEntity || isPending}
          onClick={() => void call("media_play_pause")}
          className="rounded-full border-2 border-accent bg-white/5 p-5 text-white shadow-[0_0_24px_rgba(96,165,250,0.25)] hover:bg-white/10 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden="true">
            <path d={ICON_PATHS[isPlaying ? "mdi:pause" : "mdi:play"]} fill="currentColor" />
          </svg>
        </button>
        <TransportButton
          icon="mdi:skip-next"
          label="Next track"
          disabled={!hasEntity || isPending}
          onClick={() => void call("media_next_track")}
        />
        <TransportButton
          icon={repeat === "one" ? "mdi:repeat-once" : "mdi:repeat"}
          label={`Repeat ${repeat}`}
          pressed={repeat !== "off"}
          disabled={!hasEntity || isPending}
          onClick={() => void call("repeat_set", { repeat: NEXT_REPEAT[repeat] })}
          size="small"
        />
      </div>

      <div className="flex items-center gap-4">
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-gray-300" aria-hidden="true">
          <path
            d={ICON_PATHS[localVolume === 0 ? "mdi:volume-off" : "mdi:volume-high"]}
            fill="currentColor"
          />
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          value={localVolume}
          aria-label="Volume"
          disabled={!hasEntity}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full accent-accent disabled:opacity-40"
          style={sliderFillStyle(localVolume, 0, 100)}
          onPointerDown={() => {
            isDraggingVolume.current = true;
          }}
          onChange={(e) => setLocalVolume(Number(e.target.value))}
          onPointerUp={(e) => {
            isDraggingVolume.current = false;
            void call("volume_set", {
              volume_level: Number((e.target as HTMLInputElement).value) / 100,
            });
          }}
        />
        <span className="w-12 text-right text-base tabular-nums text-gray-300">{localVolume}%</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ShortcutChip
          icon="mdi:speaker-multiple"
          label={item.name}
          disabled={!hasEntity}
          onClick={onSpeakers}
        />
        <ShortcutChip
          icon="mdi:magnify"
          label="Browse library"
          disabled={!hasEntity}
          onClick={() => onBrowse()}
        />
        <ShortcutChip
          icon="mdi:playlist-music"
          label="Playlists"
          disabled={!hasEntity}
          onClick={() => onBrowse("playlist")}
        />
      </div>
    </div>
  );
}

// ─── Small presentational pieces ────────────────────────────────────────────

function TransportButton({
  icon,
  label,
  onClick,
  disabled,
  pressed,
  size = "large",
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
  pressed?: boolean;
  size?: "small" | "large";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-full p-3 transition-colors hover:bg-white/10 disabled:opacity-40",
        pressed ? "text-accent" : "text-white/80 hover:text-white",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 24 24"
        className={size === "large" ? "h-9 w-9" : "h-6 w-6"}
        aria-hidden="true"
      >
        <path d={ICON_PATHS[icon]} fill="currentColor" />
      </svg>
    </button>
  );
}

function ShortcutChip({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white hover:bg-white/10 disabled:opacity-40"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
        <path d={ICON_PATHS[icon]} fill="currentColor" />
      </svg>
      <span className="truncate">{label}</span>
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Music Assistant URIs look like "spotify://track/123" — the scheme is the
 * provider the current item came from, which is what the reference design's
 * "Spotify" pill shows. Returns null when the attribute isn't a provider URI.
 */
function sourceFromContentId(contentId: string | null): string | null {
  const match = contentId ? /^([a-z0-9_-]+):\/\//i.exec(contentId) : null;
  if (!match?.[1]) return null;
  const scheme = match[1].split("--")[0] ?? match[1];
  return scheme.charAt(0).toUpperCase() + scheme.slice(1);
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mmss = `${hours ? String(minutes).padStart(2, "0") : minutes}:${String(seconds).padStart(2, "0")}`;
  return hours ? `${hours}:${mmss}` : mmss;
}
