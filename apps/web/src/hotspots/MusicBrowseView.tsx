import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { MusicLibraryItem, MusicLibraryMediaType, MusicSearchResults } from "../api/client.ts";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import { ICON_PATHS } from "./icons.ts";
import { ErrorNotice, errorMessage } from "./MusicErrorNotice.tsx";
import { MusicArt } from "./MusicArt.tsx";

const PAGE_SIZE = 100;

const ROOT_CATEGORIES: Array<{ mediaType: MusicLibraryMediaType; title: string }> = [
  { mediaType: "playlist", title: "Playlists" },
  { mediaType: "artist", title: "Artists" },
  { mediaType: "album", title: "Albums" },
  { mediaType: "track", title: "Tracks" },
  { mediaType: "radio", title: "Radio stations" },
  { mediaType: "podcast", title: "Podcasts" },
  { mediaType: "audiobook", title: "Audiobooks" },
];

/** A "container" type drills into a sub-list when tapped; anything else plays immediately. */
const CONTAINER_TYPES = new Set(["artist", "album", "playlist"]);

type BrowsePathEntry =
  | { kind: "category"; mediaType: MusicLibraryMediaType; title: string }
  | { kind: "artist" | "album" | "playlist"; uri: string; title: string };

interface MusicBrowseViewProps {
  entityId: string;
  onPlayed: () => void;
}

/**
 * Drill-down browser for the Music Assistant library (Artists/Albums/Tracks/
 * Playlists/Radio/Podcasts/Audiobooks), plus a search box across the whole
 * library at once.
 *
 * Talks directly to the Music Assistant server (via /api/music/*) rather
 * than HA's media_player/browse_media, which silently caps every folder
 * around 500 items (confirmed live: a 500+ track library reported exactly
 * 500 children with "not_shown: 0") and has no paginated service at all for
 * drilling into a specific artist/album/playlist's contents. Search stays on
 * HA's music_assistant.search service, which is already complete.
 */
export function MusicBrowseView({ entityId, onPlayed }: MusicBrowseViewProps) {
  const [path, setPath] = useState<BrowsePathEntry[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const addToast = useToastStore((s) => s.addToast);
  const [isPlaying, setIsPlaying] = useState(false);

  const current = path[path.length - 1];
  const showingSearch = activeQuery.trim() !== "";

  const categoryQuery = useInfiniteQuery({
    queryKey: ["music-library", current?.kind === "category" ? current.mediaType : null],
    queryFn: ({ pageParam }) => api.music.library((current as { mediaType: MusicLibraryMediaType }).mediaType, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined),
    enabled: !showingSearch && current?.kind === "category",
    staleTime: 30 * 1000,
  });

  const artistQuery = useQuery({
    queryKey: ["music-artist", current?.kind === "artist" ? current.uri : null],
    queryFn: () => api.music.artist((current as { uri: string }).uri),
    enabled: !showingSearch && current?.kind === "artist",
    staleTime: 30 * 1000,
  });

  const albumQuery = useQuery({
    queryKey: ["music-album", current?.kind === "album" ? current.uri : null],
    queryFn: () => api.music.album((current as { uri: string }).uri),
    enabled: !showingSearch && current?.kind === "album",
    staleTime: 30 * 1000,
  });

  const playlistQuery = useInfiniteQuery({
    queryKey: ["music-playlist", current?.kind === "playlist" ? current.uri : null],
    queryFn: ({ pageParam }) => api.music.playlist((current as { uri: string }).uri, PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined),
    enabled: !showingSearch && current?.kind === "playlist",
    staleTime: 30 * 1000,
  });

  const searchQuery = useQuery({
    queryKey: ["music-search", activeQuery],
    queryFn: () => api.ha.searchMedia(activeQuery),
    enabled: showingSearch,
    staleTime: 30 * 1000,
  });

  async function playUri(mediaId: string, mediaType?: string) {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      await api.ha.callService("music_assistant", "play_media", {
        serviceData: { media_id: mediaId, ...(mediaType ? { media_type: mediaType } : {}) },
        target: { entityId },
      });
      onPlayed();
    } catch (err) {
      addToast(`Play failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsPlaying(false);
    }
  }

  function openCategory(mediaType: MusicLibraryMediaType, title: string) {
    setPath((p) => [...p, { kind: "category", mediaType, title }]);
  }

  function handleItemTap(item: MusicLibraryItem) {
    if (item.media_type === "artist" || item.media_type === "album" || item.media_type === "playlist") {
      setPath((p) => [...p, { kind: item.media_type as "artist" | "album" | "playlist", uri: item.uri, title: item.name }]);
    } else {
      void playUri(item.uri, item.media_type);
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveQuery(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput("");
    setActiveQuery("");
  }

  return (
    <div className="flex max-h-[60vh] flex-col gap-3">
      <form onSubmit={submitSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search artists, albums, tracks, playlists…"
          className="input-field flex-1"
        />
        {showingSearch ? (
          <button type="button" onClick={clearSearch} className="rounded-lg bg-white/10 px-3 text-sm text-gray-300 hover:bg-white/20">
            Clear
          </button>
        ) : (
          <button type="submit" className="rounded-lg bg-accent/80 px-3 text-sm font-medium text-white hover:bg-accent">
            Search
          </button>
        )}
      </form>

      {!showingSearch && (
        <div className="flex flex-wrap items-center gap-1 text-sm text-gray-400">
          <button type="button" onClick={() => setPath([])} className="hover:text-white" disabled={path.length === 0}>
            Library
          </button>
          {path.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-gray-600">/</span>
              <button
                type="button"
                onClick={() => setPath(path.slice(0, i + 1))}
                className={i === path.length - 1 ? "text-white" : "hover:text-white"}
                disabled={i === path.length - 1}
              >
                {p.title}
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {showingSearch ? (
          searchQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-gray-500">Searching…</p>
          ) : searchQuery.isError ? (
            <ErrorNotice message={errorMessage(searchQuery.error)} />
          ) : (
            <SearchResultsList results={searchQuery.data} onPlay={playUri} disabled={isPlaying} />
          )
        ) : !current ? (
          <ul className="flex flex-col gap-1">
            {ROOT_CATEGORIES.map((c) => (
              <li key={c.mediaType}>
                <button
                  type="button"
                  onClick={() => openCategory(c.mediaType, c.title)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm text-white hover:bg-white/5"
                >
                  {c.title}
                  <span className="text-gray-500">›</span>
                </button>
              </li>
            ))}
          </ul>
        ) : current.kind === "category" ? (
          categoryQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
          ) : categoryQuery.isError ? (
            <ErrorNotice message={errorMessage(categoryQuery.error)} />
          ) : (
            <LibraryItemList
              items={categoryQuery.data?.pages.flat() ?? []}
              onTap={handleItemTap}
              onPlay={(item) => void playUri(item.uri, item.media_type)}
              disabled={isPlaying}
              hasMore={categoryQuery.hasNextPage}
              loadingMore={categoryQuery.isFetchingNextPage}
              onLoadMore={() => void categoryQuery.fetchNextPage()}
            />
          )
        ) : current.kind === "artist" ? (
          artistQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
          ) : artistQuery.isError ? (
            <ErrorNotice message={errorMessage(artistQuery.error)} />
          ) : (
            <ArtistDetail
              detail={artistQuery.data}
              onTapAlbum={handleItemTap}
              onPlay={(item) => void playUri(item.uri, item.media_type)}
              disabled={isPlaying}
            />
          )
        ) : current.kind === "album" ? (
          albumQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
          ) : albumQuery.isError ? (
            <ErrorNotice message={errorMessage(albumQuery.error)} />
          ) : (
            <LibraryItemList
              items={albumQuery.data ?? []}
              onTap={handleItemTap}
              onPlay={(item) => void playUri(item.uri, item.media_type)}
              disabled={isPlaying}
              hasMore={false}
              loadingMore={false}
              onLoadMore={() => {}}
            />
          )
        ) : playlistQuery.isLoading ? (
          <p className="py-6 text-center text-sm text-gray-500">Loading…</p>
        ) : playlistQuery.isError ? (
          <ErrorNotice message={errorMessage(playlistQuery.error)} />
        ) : (
          <LibraryItemList
            items={playlistQuery.data?.pages.flat() ?? []}
            onTap={handleItemTap}
            onPlay={(item) => void playUri(item.uri, item.media_type)}
            disabled={isPlaying}
            hasMore={playlistQuery.hasNextPage}
            loadingMore={playlistQuery.isFetchingNextPage}
            onLoadMore={() => void playlistQuery.fetchNextPage()}
          />
        )}
      </div>
    </div>
  );
}

// ─── Library listing (root categories, album tracks, playlist tracks) ───────

function LibraryItemList({
  items,
  onTap,
  onPlay,
  disabled,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  items: MusicLibraryItem[];
  onTap: (item: MusicLibraryItem) => void;
  onPlay: (item: MusicLibraryItem) => void;
  disabled: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">Nothing here</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={`${item.uri}-${i}`}>
            <LibraryItemRow item={item} onTap={() => onTap(item)} onPlay={() => onPlay(item)} disabled={disabled} />
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-1 rounded-lg bg-white/5 py-2 text-[12px] text-gray-400 hover:bg-white/10 disabled:opacity-40"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function LibraryItemRow({
  item,
  onTap,
  onPlay,
  disabled,
}: {
  item: MusicLibraryItem;
  onTap: () => void;
  onPlay: () => void;
  disabled: boolean;
}) {
  const subtitle = item.artists?.map((a) => a.name).join(", ") ?? item.album?.name ?? null;

  if (CONTAINER_TYPES.has(item.media_type)) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-white/5">
        <button type="button" onClick={onTap} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <Thumbnail url={item.image} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-white">{item.name}</span>
            {subtitle && <span className="block truncate text-[11px] text-gray-500">{subtitle}</span>}
          </span>
        </button>
        {item.is_playable && (
          <button
            type="button"
            aria-label={`Play ${item.name}`}
            disabled={disabled}
            onClick={onPlay}
            className="shrink-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-40"
          >
            <PlayIcon />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/5 disabled:opacity-40"
    >
      <Thumbnail url={item.image} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{item.name}</span>
        {subtitle && <span className="block truncate text-[11px] text-gray-500">{subtitle}</span>}
      </span>
      <PlayIcon className="shrink-0 text-gray-400" />
    </button>
  );
}

// ─── Artist detail (albums + popular tracks) ─────────────────────────────────

function ArtistDetail({
  detail,
  onTapAlbum,
  onPlay,
  disabled,
}: {
  detail: { albums: MusicLibraryItem[]; tracks: MusicLibraryItem[] } | undefined;
  onTapAlbum: (item: MusicLibraryItem) => void;
  onPlay: (item: MusicLibraryItem) => void;
  disabled: boolean;
}) {
  if (!detail || (detail.albums.length === 0 && detail.tracks.length === 0)) {
    return <p className="py-6 text-center text-sm text-gray-500">Nothing here</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {detail.albums.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Albums</p>
          <ul className="flex flex-col gap-1">
            {detail.albums.map((item) => (
              <li key={item.uri}>
                <LibraryItemRow item={item} onTap={() => onTapAlbum(item)} onPlay={() => onPlay(item)} disabled={disabled} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {detail.tracks.length > 0 && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Popular tracks</p>
          <ul className="flex flex-col gap-1">
            {detail.tracks.map((item) => (
              <li key={item.uri}>
                <LibraryItemRow item={item} onTap={() => onPlay(item)} onPlay={() => onPlay(item)} disabled={disabled} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Search results ─────────────────────────────────────────────────────────

const SEARCH_CATEGORIES: Array<{ key: keyof MusicSearchResults; label: string }> = [
  { key: "playlists", label: "Playlists" },
  { key: "tracks", label: "Tracks" },
  { key: "artists", label: "Artists" },
  { key: "albums", label: "Albums" },
  { key: "radio", label: "Radio" },
  { key: "podcasts", label: "Podcasts" },
  { key: "audiobooks", label: "Audiobooks" },
];

function SearchResultsList({
  results,
  onPlay,
  disabled,
}: {
  results: MusicSearchResults | undefined;
  onPlay: (mediaId: string, mediaType?: string) => void;
  disabled: boolean;
}) {
  if (!results) return null;
  const nonEmpty = SEARCH_CATEGORIES.filter((c) => (results[c.key]?.length ?? 0) > 0);
  if (nonEmpty.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No results</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {nonEmpty.map(({ key, label }) => (
        <div key={key}>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <ul className="flex flex-col gap-1">
            {results[key].slice(0, 8).map((item, i) => (
              <li key={`${item.uri}-${i}`}>
                <SearchResultRow item={item} onPlay={() => onPlay(item.uri, item.media_type)} disabled={disabled} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SearchResultRow({ item, onPlay, disabled }: { item: MusicLibraryItem; onPlay: () => void; disabled: boolean }) {
  const subtitle = item.artists?.map((a) => a.name).join(", ") ?? item.album?.name ?? null;
  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/5 disabled:opacity-40"
    >
      <Thumbnail url={item.image} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-white">{item.name}</span>
        {subtitle && <span className="block truncate text-[11px] text-gray-500">{subtitle}</span>}
      </span>
      <PlayIcon className="shrink-0 text-gray-400" />
    </button>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function PlayIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={["h-4 w-4", className].join(" ")}>
      <path d={ICON_PATHS["mdi:play"]} fill="currentColor" />
    </svg>
  );
}

function Thumbnail({ url }: { url: string | null }) {
  return (
    <MusicArt
      src={url ? api.ha.imageProxyUrl(url) : null}
      sizeClass="h-9 w-9"
      fallback={
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white/10">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d={ICON_PATHS["mdi:music-note"]} fill="#9ca3af" />
          </svg>
        </div>
      }
    />
  );
}
