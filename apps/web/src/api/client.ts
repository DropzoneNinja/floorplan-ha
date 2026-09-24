/**
 * Typed API client for the HomePlan HA backend.
 * All requests go through this module — never fetch the backend directly from components.
 */

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    credentials: "include",
    ...init,
  });

  if (res.status === 401) {
    // Token expired or missing — redirect to login (unless already there)
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    return Promise.reject(new Error("Unauthorized"));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type UserRecord = {
  id: string;
  email: string;
  role: string;
  isEnabled: boolean;
  failedLoginAttempts: number;
  lockedAt: string | null;
  createdAt: string;
};

export type AllowedEmailRecord = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
};

export type BackupFile = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

export const api = {
  // Auth
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string; role: string } } | { requiresPasswordReset: true; resetToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    changePassword: (token: string, newPassword: string) =>
      request<{ token: string; user: { id: string; email: string; role: string } }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      }),
    register: (email: string, password: string, confirmPassword: string) =>
      request<{ user: { id: string; email: string; role: string } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, confirmPassword }),
      }),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    me: () => request<{ id: string; email: string; role: string }>("/auth/me"),
  },

  // User management
  users: {
    list: () => request<UserRecord[]>("/users"),
    update: (id: string, data: { isEnabled?: boolean; resetLock?: boolean; resetPassword?: boolean }) =>
      request<UserRecord>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/users/${id}`, { method: "DELETE" }),
  },

  // Allowed email whitelist
  allowedEmails: {
    list: () => request<AllowedEmailRecord[]>("/allowed-emails"),
    create: (email: string, role: "admin" | "viewer") =>
      request<AllowedEmailRecord>("/allowed-emails", { method: "POST", body: JSON.stringify({ email, role }) }),
    delete: (id: string) => request<void>(`/allowed-emails/${id}`, { method: "DELETE" }),
  },

  // Dashboards
  dashboards: {
    list: () => request<unknown[]>("/dashboards"),
    getDefault: () => request<unknown>("/dashboards/default"),
    get: (id: string) => request<unknown>(`/dashboards/${id}`),
    create: (data: unknown) => request<unknown>("/dashboards", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request<unknown>(`/dashboards/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/dashboards/${id}`, { method: "DELETE" }),
  },

  // Floorplans
  floorplans: {
    list: (dashboardId?: string) =>
      request<unknown[]>(`/floorplans${dashboardId ? `?dashboardId=${dashboardId}` : ""}`),
    get: (id: string) => request<unknown>(`/floorplans/${id}`),
    create: (data: unknown) => request<unknown>("/floorplans", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request<unknown>(`/floorplans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/floorplans/${id}`, { method: "DELETE" }),
    export: async (id: string): Promise<Blob> => {
      const res = await fetch(`${BASE}/floorplans/${id}/export`, { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
      return res.blob();
    },
    import: (dashboardId: string, bundle: unknown) =>
      request<unknown>("/floorplans/import", {
        method: "POST",
        body: JSON.stringify({ dashboardId, bundle }),
      }),
  },

  // Hotspots
  hotspots: {
    list: (floorplanId?: string) =>
      request<unknown[]>(`/hotspots${floorplanId ? `?floorplanId=${floorplanId}` : ""}`),
    get: (id: string) => request<unknown>(`/hotspots/${id}`),
    create: (data: unknown) => request<unknown>("/hotspots", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request<unknown>(`/hotspots/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/hotspots/${id}`, { method: "DELETE" }),
    duplicate: (id: string) => request<unknown>(`/hotspots/${id}/duplicate`, { method: "POST" }),
    getRules: (id: string) => request<unknown[]>(`/hotspots/${id}/rules`),
    setRules: (id: string, rules: unknown[]) =>
      request<unknown[]>(`/hotspots/${id}/rules`, { method: "PUT", body: JSON.stringify({ rules }) }),
  },

  // Assets
  assets: {
    list: () => request<unknown[]>("/assets"),
    get: (id: string) => request<unknown>(`/assets/${id}`),
    fileUrl: (id: string) => `${BASE}/assets/${id}/file`,
    upload: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<unknown>("/assets/upload", { method: "POST", body: form, headers: {} });
    },
    delete: (id: string) => request<void>(`/assets/${id}`, { method: "DELETE" }),
  },

  // Home Assistant
  ha: {
    status: () => request<unknown>("/ha/status"),
    entities: () => request<unknown[]>("/ha/entities"),
    entity: (entityId: string) => request<unknown>(`/ha/entities/${entityId}`),
    services: () => request<unknown[]>("/ha/services"),
    callService: (domain: string, service: string, body?: unknown) =>
      request<unknown>(`/ha/services/${domain}/${service}`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    states: () => request<unknown[]>("/ha/states"),
    mediaImageUrl: (entityId: string) => `${BASE}/ha/media-image/${encodeURIComponent(entityId)}`,
    imageProxyUrl: (url: string) => `${BASE}/ha/media/image-proxy?url=${encodeURIComponent(url)}`,
    browseMedia: (entityId: string, mediaContentType?: string, mediaContentId?: string) => {
      const qs = new URLSearchParams({ entityId });
      if (mediaContentType !== undefined) qs.set("mediaContentType", mediaContentType);
      if (mediaContentId !== undefined) qs.set("mediaContentId", mediaContentId);
      return request<BrowseMediaNode>(`/ha/media/browse?${qs.toString()}`);
    },
    getQueue: (entityId: string) => request<MusicQueueSummary | null>(`/ha/media/queue/${encodeURIComponent(entityId)}`),
    moveQueueItem: (entityId: string, queueItemId: string, posShift: number) =>
      request<void>(`/ha/media/queue/${encodeURIComponent(entityId)}/items/${encodeURIComponent(queueItemId)}/move`, {
        method: "POST",
        body: JSON.stringify({ posShift }),
      }),
    removeQueueItem: (entityId: string, queueItemId: string) =>
      request<void>(`/ha/media/queue/${encodeURIComponent(entityId)}/items/${encodeURIComponent(queueItemId)}`, {
        method: "DELETE",
      }),
    searchMedia: (query: string) => request<MusicSearchResults>(`/ha/media/search?q=${encodeURIComponent(query)}`),
    config: () => request<{ latitude: number; longitude: number }>("/ha/config"),
    previewState: (state: string, rules: unknown[]) =>
      request<{ matchedRuleIndex: number | null; result: unknown | null }>("/ha/preview-state", {
        method: "POST",
        body: JSON.stringify({ state, rules }),
      }),
    calendarEvents: (entityId: string, days = 30) =>
      request<Array<{ summary: string; start: { date?: string; dateTime?: string }; end: { date?: string; dateTime?: string } }>>(
        `/ha/calendar/${encodeURIComponent(entityId)}/events?days=${days}`,
      ),
    history: (entityId: string, date: string) =>
      request<{ readings: Array<{ time: string; value: number }> }>(
        `/ha/history/${encodeURIComponent(entityId)}?date=${encodeURIComponent(date)}`,
      ),
    historyRange: (entityId: string, start: string, end: string) =>
      request<{ readings: Array<{ time: string; value: number }> }>(
        `/ha/history-range/${encodeURIComponent(entityId)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      ),
    statistics: (entityId: string, start: string, end: string, period: "5minute" | "hour" | "day" | "week" | "month" = "month", types: string = "change") =>
      request<{ statistics: Array<{ start: number; max: number | null; min: number | null; mean: number | null; sum: number | null; state: number | null; change: number | null }> }>(
        `/ha/statistics/${encodeURIComponent(entityId)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&period=${period}&types=${encodeURIComponent(types)}`,
      ),
  },

  // Music Assistant — talks directly to the MA server (not through HA) for
  // library browsing; see apps/api/src/routes/music.ts for why.
  music: {
    library: (type: MusicLibraryMediaType, limit = 100, offset = 0) =>
      request<MusicLibraryItem[]>(`/music/library?type=${type}&limit=${limit}&offset=${offset}`),
    artist: (uri: string) =>
      request<{ albums: MusicLibraryItem[]; tracks: MusicLibraryItem[] }>(`/music/artist?uri=${encodeURIComponent(uri)}`),
    album: (uri: string) => request<MusicLibraryItem[]>(`/music/album?uri=${encodeURIComponent(uri)}`),
    playlist: (uri: string, limit = 100, offset = 0) =>
      request<MusicLibraryItem[]>(`/music/playlist?uri=${encodeURIComponent(uri)}&limit=${limit}&offset=${offset}`),
  },

  // Backup & Restore
  backup: {
    list: () => request<BackupFile[]>("/backup/list"),
    create: () => request<BackupFile>("/backup/create", { method: "POST" }),
    downloadUrl: (filename: string) => `${BASE}/backup/download/${encodeURIComponent(filename)}`,
    delete: (filename: string) =>
      request<void>(`/backup/${encodeURIComponent(filename)}`, { method: "DELETE" }),
    restore: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return request<{ success: boolean; message: string }>("/backup/restore", {
        method: "POST",
        body: form,
        headers: {},
      });
    },
  },

  // Settings
  settings: {
    list: () => request<Record<string, unknown>>("/settings"),
    set: (key: string, value: unknown) =>
      request<unknown>(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
  },

  // Revisions
  revisions: {
    list: (params?: { entity_type?: string; entity_id?: string }) => {
      const qs = new URLSearchParams();
      if (params?.entity_type) qs.set("entity_type", params.entity_type);
      if (params?.entity_id) qs.set("entity_id", params.entity_id);
      const q = qs.toString();
      return request<unknown[]>(`/revisions${q ? `?${q}` : ""}`);
    },
  },

  // Weather (Open-Meteo via backend proxy)
  weather: {
    forecast: () => request<WeatherForecastResponse>("/weather/forecast"),
    hourly: (date: string) => request<WeatherHourlyResponse>(`/weather/forecast/hourly?date=${date}`),
  },

  // CFA Total Fire Ban status (Central district, Victoria)
  fireban: {
    status: () => request<{ totalFireban: boolean; fetchedAt: string }>("/fireban/status"),
  },

};

// ─── Weather API response types ───────────────────────────────────────────────

export interface WeatherForecastResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  current_weather: {
    temperature: number;
    weathercode: number;
    windspeed: number;
    is_day: number;
  };
  daily: {
    time: string[];               // YYYY-MM-DD
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
}

// ─── Music Assistant response types ───────────────────────────────────────────
// Shapes confirmed by exercising the live media_player.browse_media / music_assistant.*
// services — see MUSIC.md for the discovery notes.

export interface BrowseMediaNode {
  title: string;
  media_class: string;
  media_content_type: string;
  media_content_id: string;
  children_media_class: string | null;
  can_play: boolean;
  can_expand: boolean;
  can_search: boolean;
  thumbnail: string | null;
  children?: BrowseMediaNode[];
}

export type MusicLibraryMediaType = "artist" | "album" | "track" | "playlist" | "radio" | "podcast" | "audiobook";

/**
 * A Music Assistant library item, as returned by music_assistant.search (and
 * nested in queue items) or by the direct-MA /api/music/* browse endpoints.
 * is_playable is only populated by the browse endpoints — search's HA-side
 * flattening doesn't include it.
 */
export interface MusicLibraryItem {
  media_type: string;
  uri: string;
  name: string;
  image: string | null;
  favorite: boolean;
  is_playable?: boolean;
  artists?: Array<{ name: string }>;
  album?: { name: string };
}

export interface MusicSearchResults {
  artists: MusicLibraryItem[];
  albums: MusicLibraryItem[];
  tracks: MusicLibraryItem[];
  playlists: MusicLibraryItem[];
  radio: MusicLibraryItem[];
  audiobooks: MusicLibraryItem[];
  podcasts: MusicLibraryItem[];
}

export interface MusicQueueItem {
  queue_item_id: string;
  name: string;
  duration: number | null;
  media_item?: {
    name: string;
    artists?: Array<{ name: string }>;
    album?: { name: string };
    image?: string | null;
  } | null;
}

export interface MusicQueueSummary {
  queue_id: string;
  active: boolean;
  name: string;
  items: number;
  shuffle_enabled: boolean;
  repeat_mode: string;
  current_index: number;
  elapsed_time: number;
  current_item: MusicQueueItem | null;
  next_item: MusicQueueItem | null;
  /**
   * Up to 50 upcoming queue items (current track first), fetched directly from
   * the Music Assistant server. Absent/undefined when MA_BASE_URL/MA_TOKEN
   * aren't configured on the backend — callers fall back to current_item/next_item.
   */
  queue_items?: MusicQueueItem[];
}

export interface WeatherHourlyResponse {
  date: string;
  hourly: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
    precipitation_probability: number[];
    windspeed_10m: number[];
    is_day: number[];
    uv_index: number[];
  };
}
