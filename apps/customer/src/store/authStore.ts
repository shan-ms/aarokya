import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  intent: string | null;
  hasConsented: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string, refreshToken: string) => void;
  setIntent: (intent: string) => void;
  setConsented: (consented: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  intent: null,
  hasConsented: false,

  login: (token, refreshToken, user) =>
    set({
      token,
      refreshToken,
      user,
      isAuthenticated: true,
    }),

  logout: () =>
    set({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      intent: null,
      hasConsented: false,
    }),

  setUser: (user) => set({ user }),

  setToken: (token, refreshToken) => set({ token, refreshToken }),

  setIntent: (intent) => set({ intent }),

  setConsented: (consented) => set({ hasConsented: consented }),
}));
