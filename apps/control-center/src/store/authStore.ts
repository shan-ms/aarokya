'use client';

import { create } from 'zustand';
import { AdminUser } from '@/types';
import { getToken, setToken, removeToken, isAuthenticated } from '@/lib/auth';
import api from '@/lib/api';
import { ALL_PERMISSIONS } from '@/lib/rbac';

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

function setCookie(token: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `aarokya_cc_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

function removeCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = 'aarokya_cc_token=; path=/; max-age=0; SameSite=Lax';
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
    // Sync cookie with localStorage token
    if (token && authenticated) {
      setCookie(token);
    }
  },

  login: async (phone: string, otp: string) => {
    const response = await api.post('/auth/verify-otp', { phone, otp, user_type: 'operator_super_admin' });
    const { access_token, user_id, user_type } = response.data;

    setToken(access_token);
    setCookie(access_token);
    // Dev login: operators get full access (super_admin=all, others=all permissions)
    let permissions: string[] = [];
    if (user_type === 'operator_super_admin') permissions = ['all'];
    else if (user_type.startsWith('operator_')) permissions = [...ALL_PERMISSIONS];
    const user: AdminUser = {
      id: String(user_id),
      name: '',
      email: '',
      phone,
      role: { id: '1', name: user_type, permissions, created_at: new Date().toISOString() },
    };
    set({
      token: access_token,
      user,
      role: user_type,
      isAuthenticated: true,
    });
  },

  logout: () => {
    removeToken();
    removeCookie();
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
      removeCookie();
      set({
        token: null,
        user: null,
        role: null,
        isAuthenticated: false,
      });
    }
  },
}));
