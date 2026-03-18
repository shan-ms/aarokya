/**
 * ART: Auth Store Tests
 *
 * Tests the Zustand auth store for login, logout, token management,
 * and user state transitions.
 */

import { useAuthStore } from '../../store/authStore';
import { User } from '../../types';

const mockUser: User = {
  id: 'user-001',
  phone: '+919876543210',
  name: 'Ramesh Kumar',
  email: 'ramesh@example.com',
  abhaId: 'ABHA-12345',
  language: 'hi',
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-01-15T10:00:00Z',
};

const mockToken = 'eyJhbGciOiJIUzI1NiJ9.mock-access-token';
const mockRefreshToken = 'eyJhbGciOiJIUzI1NiJ9.mock-refresh-token';

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  describe('initial state', () => {
    it('should start with null token', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
    });

    it('should start with null refreshToken', () => {
      const state = useAuthStore.getState();
      expect(state.refreshToken).toBeNull();
    });

    it('should start with null user', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
    });

    it('should start as not authenticated', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('login', () => {
    it('should set token, refreshToken, and user on login', () => {
      useAuthStore.getState().login(mockToken, mockRefreshToken, mockUser);

      const state = useAuthStore.getState();
      expect(state.token).toBe(mockToken);
      expect(state.refreshToken).toBe(mockRefreshToken);
      expect(state.user).toEqual(mockUser);
    });

    it('should set isAuthenticated to true on login', () => {
      useAuthStore.getState().login(mockToken, mockRefreshToken, mockUser);

      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should overwrite previous session on re-login', () => {
      useAuthStore.getState().login(mockToken, mockRefreshToken, mockUser);

      const newUser: User = { ...mockUser, id: 'user-002', name: 'Suresh' };
      const newToken = 'new-token';
      const newRefresh = 'new-refresh';

      useAuthStore.getState().login(newToken, newRefresh, newUser);

      const state = useAuthStore.getState();
      expect(state.token).toBe(newToken);
      expect(state.refreshToken).toBe(newRefresh);
      expect(state.user?.id).toBe('user-002');
    });
  });

  describe('logout', () => {
    it('should clear all auth state on logout', () => {
      useAuthStore.getState().login(mockToken, mockRefreshToken, mockUser);
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('should be safe to call logout when already logged out', () => {
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    it('should update the user without affecting token', () => {
      useAuthStore.getState().login(mockToken, mockRefreshToken, mockUser);

      const updatedUser: User = { ...mockUser, name: 'Ramesh K.' };
      useAuthStore.getState().setUser(updatedUser);

      const state = useAuthStore.getState();
      expect(state.user?.name).toBe('Ramesh K.');
      expect(state.token).toBe(mockToken);
    });

    it('should allow setting user even when not authenticated', () => {
      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      // isAuthenticated is NOT changed by setUser
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setToken', () => {
    it('should update tokens without affecting user', () => {
      useAuthStore.getState().login(mockToken, mockRefreshToken, mockUser);

      const newToken = 'refreshed-token';
      const newRefresh = 'refreshed-refresh-token';
      useAuthStore.getState().setToken(newToken, newRefresh);

      const state = useAuthStore.getState();
      expect(state.token).toBe(newToken);
      expect(state.refreshToken).toBe(newRefresh);
      expect(state.user).toEqual(mockUser);
    });

    it('should not change isAuthenticated', () => {
      useAuthStore.getState().setToken('new-token', 'new-refresh');

      // isAuthenticated is not modified by setToken
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('state isolation', () => {
    it('should allow reading state via getState without subscription', () => {
      useAuthStore.getState().login(mockToken, mockRefreshToken, mockUser);
      const token = useAuthStore.getState().token;
      expect(token).toBe(mockToken);
    });
  });
});
