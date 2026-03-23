/**
 * ART – Auth Zustand store tests
 *
 * Covers:
 *  - initialize() reads localStorage + sets isAuthenticated
 *  - login() calls API, stores token, sets user/role
 *  - logout() clears everything
 *  - fetchUser() populates user from /auth/me
 *  - fetchUser() error handling (clears auth state)
 */

import { useAuthStore } from '@/store/authStore';
import * as authLib from '@/lib/auth';

// Mock the api module
jest.mock('@/lib/api', () => {
  return {
    __esModule: true,
    default: {
      post: jest.fn(),
      get: jest.fn(),
    },
  };
});

// Import the mocked api
import api from '@/lib/api';
const mockApi = api as jest.Mocked<typeof api>;

// Helper: create a fake JWT
function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-sig`;
}

const mockAdminUser = {
  id: 'admin-1',
  name: 'Test Admin',
  email: 'admin@aarokya.in',
  phone: '+919876543210',
  role: {
    id: 'role-1',
    name: 'super_admin',
    permissions: ['all'],
    created_at: '2025-01-01T00:00:00Z',
  },
};

beforeEach(() => {
  localStorage.clear();
  // Reset Zustand store to initial state
  useAuthStore.setState({
    token: null,
    user: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  });
  jest.clearAllMocks();
  // Clear cookies
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: '',
  });
});

// ── initialize ─────────────────────────────────────────────────────

describe('initialize', () => {
  it('sets isAuthenticated=false and isLoading=false when no token exists', () => {
    useAuthStore.getState().initialize();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.token).toBeNull();
  });

  it('sets isAuthenticated=true when valid token exists', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = createFakeJwt({ exp: futureExp, sub: 'user-1' });
    localStorage.setItem('aarokya_cc_token', token);

    useAuthStore.getState().initialize();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(token);
    expect(state.isLoading).toBe(false);
  });

  it('sets isAuthenticated=false when token is expired', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const token = createFakeJwt({ exp: pastExp, sub: 'user-1' });
    localStorage.setItem('aarokya_cc_token', token);

    useAuthStore.getState().initialize();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });
});

// ── login ──────────────────────────────────────────────────────────

describe('login', () => {
  it('stores token and user on successful login', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = createFakeJwt({ exp: futureExp, sub: 'admin-1' });

    (mockApi.post as jest.Mock).mockResolvedValueOnce({
      data: {
        access_token: accessToken,
        user: mockAdminUser,
      },
    });

    await useAuthStore.getState().login('+919876543210', '123456');

    const state = useAuthStore.getState();
    expect(state.token).toBe(accessToken);
    expect(state.user).toEqual(mockAdminUser);
    expect(state.role).toBe('super_admin');
    expect(state.isAuthenticated).toBe(true);
  });

  it('calls the verify-otp endpoint with phone and otp', async () => {
    (mockApi.post as jest.Mock).mockResolvedValueOnce({
      data: { access_token: 'tok', user: mockAdminUser },
    });

    await useAuthStore.getState().login('+919876543210', '654321');
    expect(mockApi.post).toHaveBeenCalledWith('/auth/verify-otp', {
      phone: '+919876543210',
      otp: '654321',
    });
  });

  it('throws on API error (does not change state)', async () => {
    (mockApi.post as jest.Mock).mockRejectedValueOnce(new Error('Invalid OTP'));

    await expect(useAuthStore.getState().login('+919876543210', '000000')).rejects.toThrow();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
  });
});

// ── logout ─────────────────────────────────────────────────────────

describe('logout', () => {
  it('clears token, user, role, and sets isAuthenticated=false', () => {
    // Pre-set authenticated state
    useAuthStore.setState({
      token: 'some-token',
      user: mockAdminUser,
      role: 'super_admin',
      isAuthenticated: true,
      isLoading: false,
    });
    localStorage.setItem('aarokya_cc_token', 'some-token');

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.role).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('removes tokens from localStorage', () => {
    localStorage.setItem('aarokya_cc_token', 'tok');
    localStorage.setItem('aarokya_cc_refresh_token', 'ref');

    useAuthStore.getState().logout();

    expect(localStorage.removeItem).toHaveBeenCalledWith('aarokya_cc_token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('aarokya_cc_refresh_token');
  });
});

// ── fetchUser ──────────────────────────────────────────────────────

describe('fetchUser', () => {
  it('populates user and role from /auth/me', async () => {
    (mockApi.get as jest.Mock).mockResolvedValueOnce({ data: mockAdminUser });

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockAdminUser);
    expect(state.role).toBe('super_admin');
  });

  it('handles user with no role name gracefully', async () => {
    const userNoRole = { ...mockAdminUser, role: { ...mockAdminUser.role, name: '' } };
    (mockApi.get as jest.Mock).mockResolvedValueOnce({ data: userNoRole });

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    // Empty string is falsy, so role should be null
    expect(state.role).toBeNull();
  });

  it('clears auth state on API error', async () => {
    useAuthStore.setState({
      token: 'some-token',
      user: mockAdminUser,
      role: 'super_admin',
      isAuthenticated: true,
    });

    (mockApi.get as jest.Mock).mockRejectedValueOnce(new Error('401'));

    await useAuthStore.getState().fetchUser();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.role).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
  });
});
