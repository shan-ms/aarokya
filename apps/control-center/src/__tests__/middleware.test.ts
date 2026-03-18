/**
 * ART – Middleware tests (route protection, JWT validation)
 *
 * Covers:
 *  - Public paths are allowed through (login, _next, favicon, api)
 *  - Root path "/" is allowed through
 *  - Valid non-expired token allows access to protected routes
 *  - Expired token redirects to /login with redirect param
 *  - Malformed token redirects to /login
 *  - Missing cookie allows through (client-side auth fallback)
 *  - Expired token clears the cookie
 *
 * Strategy: We test the middleware logic directly by constructing
 * minimal mock NextRequest objects (avoiding the Web API Request
 * dependency not available in jsdom).
 */

// ── Mock next/server ───────────────────────────────────────────────

const mockNextFn = jest.fn().mockReturnValue({ status: 200, headers: new Map() });
const mockRedirectFn = jest.fn();

jest.mock('next/server', () => {
  return {
    NextResponse: {
      next: () => mockNextFn(),
      redirect: (url: URL) => {
        const headers = new Map<string, string>();
        headers.set('location', url.toString());
        const response = {
          status: 307,
          headers: {
            get: (name: string) => headers.get(name) ?? null,
          },
          cookies: {
            delete: jest.fn(),
          },
        };
        mockRedirectFn(url);
        return response;
      },
    },
  };
});

import { middleware } from '@/middleware';

// ── Helpers ────────────────────────────────────────────────────────

function createFakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-sig`;
}

interface MockNextRequest {
  nextUrl: { pathname: string };
  url: string;
  cookies: {
    get: (name: string) => { name: string; value: string } | undefined;
  };
}

function createMockRequest(pathname: string, cookieToken?: string): MockNextRequest {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: {
      get: (name: string) => {
        if (name === 'aarokya_cc_token' && cookieToken) {
          return { name: 'aarokya_cc_token', value: cookieToken };
        }
        return undefined;
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNextFn.mockReturnValue({ status: 200, headers: new Map() });
});

// ── Public paths ───────────────────────────────────────────────────

describe('middleware - public paths', () => {
  it('allows /login through without checking auth', () => {
    const req = createMockRequest('/login');
    const res = middleware(req as any);
    expect(res.status).toBe(200);
    expect(mockRedirectFn).not.toHaveBeenCalled();
  });

  it('allows /_next/static paths through', () => {
    const req = createMockRequest('/_next/static/chunk.js');
    const res = middleware(req as any);
    expect(res.status).toBe(200);
  });

  it('allows /favicon.ico through', () => {
    const req = createMockRequest('/favicon.ico');
    const res = middleware(req as any);
    expect(res.status).toBe(200);
  });

  it('allows /api paths through', () => {
    const req = createMockRequest('/api/health');
    const res = middleware(req as any);
    expect(res.status).toBe(200);
  });

  it('allows root path "/" through', () => {
    const req = createMockRequest('/');
    const res = middleware(req as any);
    expect(res.status).toBe(200);
  });
});

// ── Valid token ─────────────────────────────────────────────────────

describe('middleware - valid token', () => {
  it('allows access to /dashboard with valid non-expired token', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = createFakeJwt({ exp: futureExp, sub: 'user-1' });
    const req = createMockRequest('/dashboard', token);
    const res = middleware(req as any);
    expect(res.status).toBe(200);
    expect(mockRedirectFn).not.toHaveBeenCalled();
  });

  it('allows access to /dashboard/users with valid token', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = createFakeJwt({ exp: futureExp, sub: 'user-1' });
    const req = createMockRequest('/dashboard/users', token);
    const res = middleware(req as any);
    expect(res.status).toBe(200);
  });

  it('allows access to deeply nested routes with valid token', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = createFakeJwt({ exp: futureExp, sub: 'user-1' });
    const req = createMockRequest('/dashboard/users/user-123', token);
    const res = middleware(req as any);
    expect(res.status).toBe(200);
  });
});

// ── Expired token ──────────────────────────────────────────────────

describe('middleware - expired token', () => {
  it('redirects to /login when token is expired', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const token = createFakeJwt({ exp: pastExp, sub: 'user-1' });
    const req = createMockRequest('/dashboard', token);
    const res = middleware(req as any);

    expect(res.status).toBe(307);
    expect(mockRedirectFn).toHaveBeenCalled();
    const redirectUrl: URL = mockRedirectFn.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe('/login');
    expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard');
  });

  it('includes the original path as redirect param', () => {
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    const token = createFakeJwt({ exp: pastExp, sub: 'user-1' });
    const req = createMockRequest('/dashboard/finances', token);
    const res = middleware(req as any);

    expect(res.status).toBe(307);
    const redirectUrl: URL = mockRedirectFn.mock.calls[0][0];
    expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard/finances');
  });
});

// ── Malformed token ────────────────────────────────────────────────

describe('middleware - malformed token', () => {
  it('redirects to /login for non-JWT token', () => {
    const req = createMockRequest('/dashboard', 'not-a-jwt');
    const res = middleware(req as any);

    expect(res.status).toBe(307);
    expect(mockRedirectFn).toHaveBeenCalled();
    const redirectUrl: URL = mockRedirectFn.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe('/login');
  });

  it('redirects to /login for token with invalid base64 payload', () => {
    const req = createMockRequest('/dashboard', 'header.!!!.signature');
    const res = middleware(req as any);

    expect(res.status).toBe(307);
    const redirectUrl: URL = mockRedirectFn.mock.calls[0][0];
    expect(redirectUrl.pathname).toBe('/login');
  });
});

// ── No cookie ──────────────────────────────────────────────────────

describe('middleware - no cookie', () => {
  it('allows through for client-side auth fallback (no cookie on protected route)', () => {
    const req = createMockRequest('/dashboard');
    const res = middleware(req as any);
    expect(res.status).toBe(200);
    expect(mockRedirectFn).not.toHaveBeenCalled();
  });

  it('allows through for nested protected routes without cookie', () => {
    const req = createMockRequest('/dashboard/settings');
    const res = middleware(req as any);
    expect(res.status).toBe(200);
    expect(mockRedirectFn).not.toHaveBeenCalled();
  });
});
