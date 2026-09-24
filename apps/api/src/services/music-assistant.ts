import WebSocket from "ws";
import { env } from "../lib/env.js";

export type MusicLibraryMediaType = "artist" | "album" | "track" | "playlist" | "radio" | "podcast" | "audiobook";

/** MA's raw MediaItem shape carries full metadata (bios, links, every known
 * image, provider mappings) — this is just the slice every call site needs. */
interface MaRawMediaItem {
  media_type: string;
  uri: string;
  name: string;
  favorite?: boolean;
  is_playable?: boolean;
  metadata?: { images?: Array<{ type: string; proxy_id: string }> };
  artists?: Array<{ name: string }>;
  album?: { name: string };
}

interface MaQueueItemRaw {
  queue_item_id: string;
  name: string;
  duration: number | null;
  media_item?: MaRawMediaItem | null;
}

export interface MusicAssistantQueueItem {
  queue_item_id: string;
  name: string;
  duration: number | null;
  media_item: MusicLibraryItem | null;
}

/** Flattened MA media item — mirrors what HA's own music_assistant.search
 * service already returns, so both sources feed the same frontend shape.
 * is_playable is browse-only (search's HA-side flattening doesn't include
 * it) — lets a container row (album/playlist) offer "play the whole thing"
 * alongside "open it", the way the old browse_media-backed UI did. */
export interface MusicLibraryItem {
  media_type: string;
  uri: string;
  name: string;
  image: string | null;
  favorite: boolean;
  is_playable: boolean | undefined;
  artists: Array<{ name: string }> | undefined;
  album: { name: string } | undefined;
}

/**
 * Talks directly to the Music Assistant server (not through HA) for anything
 * HA's own API surface can't do completely:
 *  - the full play queue (HA's music_assistant.get_queue service only
 *    exposes current_item/next_item, with no items array or pagination)
 *  - library browsing beyond the top level (HA's media_player/browse_media
 *    silently caps every folder around 500 items with an unreliable
 *    "not_shown" counter, and HA exposes no paginated service at all for
 *    drilling into a specific artist/album/playlist's contents)
 *
 * Each call opens a short-lived WebSocket connection (auth, one command,
 * close) rather than holding a persistent connection open: these are
 * on-demand, user-driven fetches (opening a dialog, paging a list), not a
 * continuous stream, so the added handshake latency isn't worth the
 * reconnect/lifecycle machinery a persistent connection would need. Live
 * now-playing state stays on HA's existing WS state-stream pipeline, which
 * already covers every hotspot type — this only replaces one-shot queries.
 */
class MusicAssistantService {
  get isConfigured(): boolean {
    return Boolean(env.MA_BASE_URL && env.MA_TOKEN);
  }

  async getQueueItems(queueId: string, limit: number, offset: number): Promise<MusicAssistantQueueItem[]> {
    const raw = await this.request<MaQueueItemRaw[]>("player_queues/items", {
      queue_id: queueId,
      limit,
      offset,
    });
    return raw.map((item) => ({
      queue_item_id: item.queue_item_id,
      name: item.name,
      duration: item.duration,
      media_item: item.media_item ? this.flattenMediaItem(item.media_item) : null,
    }));
  }

  /** Root-level flat library listing (Artists/Albums/Tracks/Playlists/Radio/
   * Podcasts/Audiobooks), paginated — the case proven to silently truncate
   * via HA's browse_media (a 500+ track library reports only 500, with
   * "not_shown: 0"). */
  async getLibraryItems(mediaType: MusicLibraryMediaType, limit: number, offset: number): Promise<MusicLibraryItem[]> {
    const raw = await this.request<MaRawMediaItem[]>(`music/${mediaType}s/library_items`, { limit, offset });
    return raw.map((item) => this.flattenMediaItem(item));
  }

  /** An artist's albums + tracks — HA has no equivalent service at all for this. */
  async getArtistDetail(uri: string): Promise<{ albums: MusicLibraryItem[]; tracks: MusicLibraryItem[] }> {
    const { provider, itemId } = this.parseUri(uri);
    const [albums, tracks] = await Promise.all([
      this.request<MaRawMediaItem[]>("music/artists/artist_albums", {
        item_id: itemId,
        provider_instance_id_or_domain: provider,
      }),
      this.request<MaRawMediaItem[]>("music/artists/artist_tracks", {
        item_id: itemId,
        provider_instance_id_or_domain: provider,
      }),
    ]);
    return {
      albums: albums.map((item) => this.flattenMediaItem(item)),
      tracks: tracks.map((item) => this.flattenMediaItem(item)),
    };
  }

  /** An album's tracks — HA has no equivalent service at all for this. */
  async getAlbumTracks(uri: string): Promise<MusicLibraryItem[]> {
    const { provider, itemId } = this.parseUri(uri);
    const raw = await this.request<MaRawMediaItem[]>("music/albums/album_tracks", {
      item_id: itemId,
      provider_instance_id_or_domain: provider,
    });
    return raw.map((item) => this.flattenMediaItem(item));
  }

  /** A playlist's tracks, paginated — playlists are the other place the
   * 500-item HA browse_media cap is easy to actually hit in practice. */
  async getPlaylistTracks(uri: string, limit: number, offset: number): Promise<MusicLibraryItem[]> {
    const { provider, itemId } = this.parseUri(uri);
    const raw = await this.request<MaRawMediaItem[]>("music/playlists/playlist_tracks", {
      item_id: itemId,
      provider_instance_id_or_domain: provider,
      limit,
      offset,
    });
    return raw.map((item) => this.flattenMediaItem(item));
  }

  /**
   * Reorder a queue item. `posShift` is relative (positive = later, negative
   * = earlier) — confirmed live: shifting an item from index 5 to 7 required
   * posShift=2 (i.e. posShift = targetIndex - sourceIndex). MA rejects
   * shifting the item at index 0 ("already played/buffered") — the currently
   * playing track can't be reordered, only upcoming ones.
   */
  async moveQueueItem(queueId: string, queueItemId: string, posShift: number): Promise<void> {
    await this.request<void>("player_queues/move_item", { queue_id: queueId, queue_item_id: queueItemId, pos_shift: posShift });
  }

  /** Remove an item from the queue. */
  async removeQueueItem(queueId: string, queueItemId: string): Promise<void> {
    await this.request<void>("player_queues/delete_item", { queue_id: queueId, item_id_or_index: queueItemId });
  }

  /** MA URIs are `{provider}://{media_type}/{item_id}` — e.g.
   * "library://album/266" — every drill-down command wants the provider and
   * item_id split back out. */
  private parseUri(uri: string): { provider: string; itemId: string } {
    const match = /^([^:]+):\/\/[^/]+\/(.+)$/.exec(uri);
    if (!match) throw new Error(`Malformed Music Assistant URI: ${uri}`);
    return { provider: match[1]!, itemId: match[2]! };
  }

  private flattenMediaItem(item: MaRawMediaItem): MusicLibraryItem {
    return {
      media_type: item.media_type,
      uri: item.uri,
      name: item.name,
      favorite: item.favorite ?? false,
      is_playable: item.is_playable,
      // MA's raw artist/album objects carry full metadata (bios, links, every
      // known image) — flatten to just what the UI reads, mirroring the shape
      // HA's own music_assistant.search/get_queue services already return.
      artists: item.artists?.map((a) => ({ name: a.name })),
      album: item.album ? { name: item.album.name } : undefined,
      image: this.firstImageUrl(item.metadata?.images),
    };
  }

  private firstImageUrl(images?: Array<{ type: string; proxy_id: string }>): string | null {
    if (!images?.length) return null;
    const thumb = images.find((img) => img.type === "thumb");
    const proxyId = thumb ? thumb.proxy_id : images[0]!.proxy_id;
    return `${env.MA_BASE_URL}/imageproxy/${proxyId}?size=0`;
  }

  private request<T>(command: string, args: Record<string, unknown>, timeoutMs = 8000): Promise<T> {
    if (!env.MA_BASE_URL || !env.MA_TOKEN) {
      return Promise.reject(new Error("Music Assistant direct access is not configured (MA_BASE_URL/MA_TOKEN)"));
    }
    const wsUrl = `${env.MA_BASE_URL.replace(/\/$/, "").replace(/^http/, "ws")}/ws`;

    return new Promise<T>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let stage: "connecting" | "authenticating" | "requesting" = "connecting";

      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error(`Music Assistant request '${command}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const finish = (fn: () => void) => {
        clearTimeout(timer);
        ws.close();
        fn();
      };

      ws.on("message", (data) => {
        let msg: { server_id?: string; message_id?: string; result?: unknown; error_code?: number; details?: string };
        try {
          msg = JSON.parse(data.toString());
        } catch {
          return;
        }

        if (stage === "connecting" && msg.server_id !== undefined) {
          stage = "authenticating";
          ws.send(JSON.stringify({ command: "auth", message_id: "auth", args: { token: env.MA_TOKEN } }));
          return;
        }

        if (stage === "authenticating" && msg.message_id === "auth") {
          if (msg.error_code) {
            finish(() => reject(new Error(`Music Assistant auth failed: ${msg.details}`)));
            return;
          }
          stage = "requesting";
          ws.send(JSON.stringify({ command, message_id: "cmd", args }));
          return;
        }

        if (stage === "requesting" && msg.message_id === "cmd") {
          if (msg.error_code) {
            finish(() => reject(new Error(`Music Assistant command '${command}' failed: ${msg.details}`)));
          } else {
            finish(() => resolve(msg.result as T));
          }
        }
      });

      ws.on("error", (err) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }
}

let instance: MusicAssistantService | null = null;

export function getMusicAssistantService(): MusicAssistantService {
  if (!instance) {
    instance = new MusicAssistantService();
  }
  return instance;
}
