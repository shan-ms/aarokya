'use client';

import { create } from 'zustand';
import { AdminUser } from '@/types';
import { getToken, setToken, removeToken, isAuthenticated } from '@/lib/auth';
import api from '@/lib/api';

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: () => {
    const token = getToken();
    const authenticated = isAuthenticated();
    set({
      token,
      isAuthenticated: authenticated,
      isLoading: false,
    });
  },

  login: async (phone: string, otp: string) => {
    const response = await api.post('/auth/verify-otp', { phone, otp });
    const { access_token, user } = response.data;

    setToken(access_token);
    set({
      token: access_token,
      user,
      role: user.role?.name || null,
      isAuthenticated: true,
    });
  },

  logout: () => {
    removeToken();
    set({
      token: null,
      user: null,
      role: null,
      isAuthenticated: false,
    });
  },

  fetchUser: async () => {
    try {
      const response = await api.get('/auth/me');
      const user = response.data;
      set({ user, role: user.role?.name || null });
    } catch {
      removeToken();
      set({
        token: null,
        user: null,
        role: null,
        isAuthenticated: false,
      });
    }
  },
}));
