/**
 * ART: Auth Store Tests
 *
 * Tests the Zustand auth store for login, logout, token management,
 * and partner profile state.
 */

import { useAuthStore } from '../../store/authStore';
import { setAuthToken, setRefreshToken } from '../../api/client';
import { Partner } from '../../types';

jest.mock('../../api/client', () => ({
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

const mockPartner: Partner = {
  id: 'partner-001',
  phone: '+919876543210',
  businessName: 'Acme Logistics',
  registrationNumber: 'CIN-U12345',
  partnerType: 'gig_platform',
  contributionScheme: {
    type: 'per_task',
    amountPaise: 5000,
    description: '₹50 per task',
  },
  totalWorkers: 150,
  totalContributedPaise: 7500000,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-03-01T12:00:00Z',
};

describe('authStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      partner: null,
      isAuthenticated: false,
      isNewPartner: false,
    });
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have null token and partner, isAuthenticated false', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.partner).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isNewPartner).toBe(false);
    });
  });

  describe('login', () => {
    it('should set tokens, partner, and isAuthenticated on login', () => {
      useAuthStore.getState().login({
        token: 'access-token-123',
        refreshToken: 'refresh-token-456',
        partner: mockPartner,
        isNewPartner: false,
      });

      const state = useAuthStore.getState();
      expect(state.token).toBe('access-token-123');
      expect(state.refreshToken).toBe('refresh-token-456');
      expect(state.partner).toEqual(mockPartner);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isNewPartner).toBe(false);
    });

    it('should call setAuthToken and setRefreshToken on the API client', () => {
      useAuthStore.getState().login({
        token: 'access-token-123',
        refreshToken: 'refresh-token-456',
        isNewPartner: false,
      });

      expect(setAuthToken).toHaveBeenCalledWith('access-token-123');
      expect(setRefreshToken).toHaveBeenCalledWith('refresh-token-456');
    });

    it('should handle login for new partner (no partner object)', () => {
      useAuthStore.getState().login({
        token: 'token-new',
        refreshToken: 'refresh-new',
        isNewPartner: true,
      });

      const state = useAuthStore.getState();
      expect(state.partner).toBeNull();
      expect(state.isNewPartner).toBe(true);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should set partner to null when partner is undefined', () => {
      useAuthStore.getState().login({
        token: 'token-abc',
        refreshToken: 'refresh-abc',
        partner: undefined,
        isNewPartner: false,
      });

      expect(useAuthStore.getState().partner).toBeNull();
    });
  });

  describe('setPartner', () => {
    it('should set partner and clear isNewPartner flag', () => {
      // Start as new partner
      useAuthStore.getState().login({
        token: 'token',
        refreshToken: 'refresh',
        isNewPartner: true,
      });
      expect(useAuthStore.getState().isNewPartner).toBe(true);

      // Complete onboarding
      useAuthStore.getState().setPartner(mockPartner);

      const state = useAuthStore.getState();
      expect(state.partner).toEqual(mockPartner);
      expect(state.isNewPartner).toBe(false);
    });
  });

  describe('updateToken', () => {
    it('should update the access token in state and API client', () => {
      useAuthStore.getState().login({
        token: 'old-token',
        refreshToken: 'refresh',
        isNewPartner: false,
      });

      useAuthStore.getState().updateToken('new-token');

      expect(useAuthStore.getState().token).toBe('new-token');
      expect(setAuthToken).toHaveBeenCalledWith('new-token');
    });

    it('should not change other state fields', () => {
      useAuthStore.getState().login({
        token: 'old-token',
        refreshToken: 'refresh-123',
        partner: mockPartner,
        isNewPartner: false,
      });

      useAuthStore.getState().updateToken('new-token');

      const state = useAuthStore.getState();
      expect(state.refreshToken).toBe('refresh-123');
      expect(state.partner).toEqual(mockPartner);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('should clear all auth state', () => {
      // Login first
      useAuthStore.getState().login({
        token: 'token',
        refreshToken: 'refresh',
        partner: mockPartner,
        isNewPartner: false,
      });

      // Then logout
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.partner).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isNewPartner).toBe(false);
    });

    it('should clear tokens on API client', () => {
      useAuthStore.getState().login({
        token: 'token',
        refreshToken: 'refresh',
        isNewPartner: false,
      });
      jest.clearAllMocks();

      useAuthStore.getState().logout();

      expect(setAuthToken).toHaveBeenCalledWith(null);
      expect(setRefreshToken).toHaveBeenCalledWith(null);
    });

    it('should be idempotent (calling logout when already logged out)', () => {
      useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
