import { create } from 'zustand';
import { Partner } from '../types';
import { setAuthToken, setRefreshToken } from '../api/client';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  partner: Partner | null;
  isAuthenticated: boolean;
  isNewPartner: boolean;

  login: (params: {
    token: string;
    refreshToken: string;
    partner?: Partner;
    isNewPartner: boolean;
  }) => void;
  setPartner: (partner: Partner) => void;
  updateToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  partner: null,
  isAuthenticated: false,
  isNewPartner: false,

  login: ({ token, refreshToken, partner, isNewPartner }) => {
    setAuthToken(token);
    setRefreshToken(refreshToken);
    set({
      token,
      refreshToken,
      partner: partner ?? null,
      isAuthenticated: true,
      isNewPartner,
    });
  },

  setPartner: (partner: Partner) => {
    set({ partner, isNewPartner: false });
  },

  updateToken: (token: string) => {
    setAuthToken(token);
    set({ token });
  },

  logout: () => {
    setAuthToken(null);
    setRefreshToken(null);
    set({
      token: null,
      refreshToken: null,
      partner: null,
      isAuthenticated: false,
      isNewPartner: false,
    });
  },
}));
