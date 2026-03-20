import { create } from "zustand";
import { api } from "../api/client.ts";

export type Theme = "dark" | "light";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Load from AppSettings and apply to DOM */
  hydrate: () => Promise<void>;
}

/** Apply Tailwind dark/light class to <html> element. */
function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  } else {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: "dark",

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    // Persist to backend settings (fire-and-forget)
    api.settings.set("theme", theme).catch(() => {
      // Non-critical — ignore persistence failures silently
    });
  },

  hydrate: async () => {
    try {
      const settings = await api.settings.list();
      const saved = settings["theme"] as Theme | undefined;
      const resolved: Theme = saved === "light" ? "light" : "dark";
      applyTheme(resolved);
      set({ theme: resolved });
    } catch {
      // Fall back to dark theme if settings unavailable
      applyTheme("dark");
    }
  },
}));
