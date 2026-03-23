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
      request<{ token: string; user: { id: string; email: string; role: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
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
    update: (id: string, data: { isEnabled?: boolean; resetLock?: boolean }) =>
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

export interface WeatherHourlyResponse {
  date: string;
  hourly: {
    time: string[];
    temperature_2m: number[];
    weathercode: number[];
    precipitation_probability: number[];
    windspeed_10m: number[];
  };
}
