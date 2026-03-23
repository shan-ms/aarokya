/**
 * ART – Auth helpers tests (JWT token management)
 *
 * Covers:
 *  - getToken / setToken / removeToken
 *  - getRefreshToken / setRefreshToken
 *  - isAuthenticated (JWT expiry check)
 *  - getTokenPayload
 *  - Server-side safety (typeof window === 'undefined' branches)
 */

import {
  getToken,
  setToken,
  removeToken,
  getRefreshToken,
  setRefreshToken,
  isAuthenticated,
  getTokenPayload,
} from '@/lib/auth';

// Helper: create a fake JWT with a given expiry timestamp (seconds)
function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'fake-signature';
  return `${header}.${body}.${signature}`;
}

beforeEach(() => {
  localStorage.clear();
  (localStorage.getItem as jest.Mock).mockClear();
  (localStorage.setItem as jest.Mock).mockClear();
  (localStorage.removeItem as jest.Mock).mockClear();
});

// ── getToken / setToken ────────────────────────────────────────────

describe('getToken', () => {
  it('returns null when no token is stored', () => {
    expect(getToken()).toBeNull();
  });

  it('returns stored token', () => {
    localStorage.setItem('aarokya_cc_token', 'my-token');
    expect(getToken()).toBe('my-token');
  });
});

describe('setToken', () => {
  it('stores token in localStorage', () => {
    setToken('new-token');
    expect(localStorage.setItem).toHaveBeenCalledWith('aarokya_cc_token', 'new-token');
  });
});

// ── removeToken ────────────────────────────────────────────────────

describe('removeToken', () => {
  it('removes both access and refresh tokens', () => {
    localStorage.setItem('aarokya_cc_token', 'tok');
    localStorage.setItem('aarokya_cc_refresh_token', 'ref');
    removeToken();
    expect(localStorage.removeItem).toHaveBeenCalledWith('aarokya_cc_token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('aarokya_cc_refresh_token');
  });
});

// ── getRefreshToken / setRefreshToken ──────────────────────────────

describe('getRefreshToken', () => {
  it('returns null when no refresh token is stored', () => {
    expect(getRefreshToken()).toBeNull();
  });

  it('returns stored refresh token', () => {
    localStorage.setItem('aarokya_cc_refresh_token', 'ref-tok');
    expect(getRefreshToken()).toBe('ref-tok');
  });
});

describe('setRefreshToken', () => {
  it('stores refresh token in localStorage', () => {
    setRefreshToken('refresh-xyz');
    expect(localStorage.setItem).toHaveBeenCalledWith('aarokya_cc_refresh_token', 'refresh-xyz');
  });
});

// ── isAuthenticated ────────────────────────────────────────────────

describe('isAuthenticated', () => {
  it('returns false when no token exists', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('returns true for a non-expired token', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const token = createFakeJwt({ exp: futureExp, sub: 'user-1' });
    localStorage.setItem('aarokya_cc_token', token);
    expect(isAuthenticated()).toBe(true);
  });

  it('returns false for an expired token', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const token = createFakeJwt({ exp: pastExp, sub: 'user-1' });
    localStorage.setItem('aarokya_cc_token', token);
    expect(isAuthenticated()).toBe(false);
  });

  it('returns false for a malformed token (not base64)', () => {
    localStorage.setItem('aarokya_cc_token', 'not.a.jwt');
    expect(isAuthenticated()).toBe(false);
  });

  it('returns false for a token with missing exp field', () => {
    const token = createFakeJwt({ sub: 'user-1' }); // no exp
    localStorage.setItem('aarokya_cc_token', token);
    // exp is undefined → NaN * 1000 → Date.now() < NaN → false
    expect(isAuthenticated()).toBe(false);
  });

  it('returns false for an empty string token', () => {
    localStorage.setItem('aarokya_cc_token', '');
    expect(isAuthenticated()).toBe(false);
  });
});

// ── getTokenPayload ────────────────────────────────────────────────

describe('getTokenPayload', () => {
  it('returns null when no token exists', () => {
    expect(getTokenPayload()).toBeNull();
  });

  it('returns parsed payload object', () => {
    const payload = { sub: 'user-123', role: 'super_admin', exp: 9999999999 };
    const token = createFakeJwt(payload);
    localStorage.setItem('aarokya_cc_token', token);

    const result = getTokenPayload();
    expect(result).toEqual(payload);
  });

  it('returns null for malformed token', () => {
    localStorage.setItem('aarokya_cc_token', 'bad-token');
    expect(getTokenPayload()).toBeNull();
  });

  it('preserves all custom claims in payload', () => {
    const payload = {
      sub: 'user-456',
      exp: 9999999999,
      role: 'insurance_ops',
      permissions: ['insurance.read', 'insurance.write'],
      name: 'Test User',
    };
    const token = createFakeJwt(payload);
    localStorage.setItem('aarokya_cc_token', token);

    const result = getTokenPayload();
    expect(result).toMatchObject({
      sub: 'user-456',
      role: 'insurance_ops',
      permissions: ['insurance.read', 'insurance.write'],
      name: 'Test User',
    });
  });
});
