import { create } from "zustand";
import { api } from "../api/client.ts";

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  /** Hydrate current user from /auth/me on app load */
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  hydrate: async () => {
    try {
      const user = await api.auth.me();
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (email, password) => {
    const { user } = await api.auth.login(email, password);
    set({ user });
  },

  logout: async () => {
    await api.auth.logout();
    set({ user: null });
  },
}));
