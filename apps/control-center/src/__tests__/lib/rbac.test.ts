/**
 * ART – Role-Based Access Control (RBAC) Tests
 *
 * Covers:
 *  - ALL_PERMISSIONS constant completeness
 *  - hasPermission() with single, multiple, and "all" wildcard permissions
 *  - canAccessRoute() for every sidebar route
 *  - getUserPermissions() edge cases (null, undefined, empty)
 *  - 7 canonical operator roles
 */

import {
  ALL_PERMISSIONS,
  hasPermission,
  canAccessRoute,
  getUserPermissions,
  SIDEBAR_PERMISSIONS,
  Permission,
} from '@/lib/rbac';

// ── Canonical role definitions (mirrors backend seed data) ─────────
const ROLES: Record<string, { permissions: string[] }> = {
  super_admin: { permissions: ['all'] },
  insurance_ops: { permissions: ['insurance.read', 'insurance.write', 'users.read'] },
  support: { permissions: ['users.read', 'users.write'] },
  analytics: { permissions: ['analytics.read'] },
  partner_manager: { permissions: ['users.read', 'finances.read'] },
  finance_auditor: { permissions: ['finances.read', 'finances.write'] },
  readonly_viewer: { permissions: ['users.read', 'finances.read', 'insurance.read', 'analytics.read', 'settings.read'] },
};

// ── ALL_PERMISSIONS ────────────────────────────────────────────────

describe('ALL_PERMISSIONS', () => {
  it('contains exactly 9 permission strings', () => {
    expect(ALL_PERMISSIONS).toHaveLength(9);
  });

  it('includes expected module.action pairs', () => {
    const expected = [
      'users.read',
      'users.write',
      'finances.read',
      'finances.write',
      'insurance.read',
      'insurance.write',
      'analytics.read',
      'settings.read',
      'settings.write',
    ];
    expect([...ALL_PERMISSIONS]).toEqual(expect.arrayContaining(expected));
  });

  it('does not include the "all" wildcard (that is a runtime concept)', () => {
    expect((ALL_PERMISSIONS as readonly string[]).includes('all')).toBe(false);
  });
});

// ── hasPermission ──────────────────────────────────────────────────

describe('hasPermission', () => {
  describe('single permission check', () => {
    it('returns true when user has the exact permission', () => {
      expect(hasPermission(['users.read'], 'users.read')).toBe(true);
    });

    it('returns false when user lacks the permission', () => {
      expect(hasPermission(['users.read'], 'users.write')).toBe(false);
    });

    it('returns false for empty user permissions', () => {
      expect(hasPermission([], 'users.read')).toBe(false);
    });
  });

  describe('multiple permissions (AND logic)', () => {
    it('returns true when user has all required permissions', () => {
      expect(hasPermission(['users.read', 'users.write', 'finances.read'], ['users.read', 'finances.read'])).toBe(true);
    });

    it('returns false when user is missing one required permission', () => {
      expect(hasPermission(['users.read'], ['users.read', 'users.write'])).toBe(false);
    });

    it('returns true for empty required array', () => {
      // every() on empty array returns true
      expect(hasPermission(['users.read'], [] as Permission[])).toBe(true);
    });
  });

  describe('"all" wildcard', () => {
    it('grants access to any single permission', () => {
      expect(hasPermission(['all'], 'finances.write')).toBe(true);
    });

    it('grants access to multiple permissions at once', () => {
      expect(hasPermission(['all'], ['users.write', 'insurance.write', 'settings.write'])).toBe(true);
    });

    it('works when "all" is mixed with other permissions', () => {
      expect(hasPermission(['all', 'users.read'], 'settings.write')).toBe(true);
    });
  });
});

// ── canAccessRoute ─────────────────────────────────────────────────

describe('canAccessRoute', () => {
  it('allows any user to access /dashboard (no permissions required)', () => {
    expect(canAccessRoute([], '/dashboard')).toBe(true);
  });

  it('requires users.read for /dashboard/users', () => {
    expect(canAccessRoute([], '/dashboard/users')).toBe(false);
    expect(canAccessRoute(['users.read'], '/dashboard/users')).toBe(true);
  });

  it('requires finances.read for /dashboard/finances', () => {
    expect(canAccessRoute([], '/dashboard/finances')).toBe(false);
    expect(canAccessRoute(['finances.read'], '/dashboard/finances')).toBe(true);
  });

  it('requires insurance.read for /dashboard/insurance', () => {
    expect(canAccessRoute(['analytics.read'], '/dashboard/insurance')).toBe(false);
    expect(canAccessRoute(['insurance.read'], '/dashboard/insurance')).toBe(true);
  });

  it('requires analytics.read for /dashboard/analytics', () => {
    expect(canAccessRoute([], '/dashboard/analytics')).toBe(false);
    expect(canAccessRoute(['analytics.read'], '/dashboard/analytics')).toBe(true);
  });

  it('requires settings.read for /dashboard/settings', () => {
    expect(canAccessRoute([], '/dashboard/settings')).toBe(false);
    expect(canAccessRoute(['settings.read'], '/dashboard/settings')).toBe(true);
  });

  it('returns true for unknown routes (not in SIDEBAR_PERMISSIONS)', () => {
    expect(canAccessRoute([], '/dashboard/unknown')).toBe(true);
  });

  it('super_admin ("all") can access every defined route', () => {
    Object.keys(SIDEBAR_PERMISSIONS).forEach((route) => {
      expect(canAccessRoute(['all'], route)).toBe(true);
    });
  });
});

// ── getUserPermissions ─────────────────────────────────────────────

describe('getUserPermissions', () => {
  it('returns permissions array from role object', () => {
    expect(getUserPermissions({ permissions: ['users.read', 'users.write'] })).toEqual(['users.read', 'users.write']);
  });

  it('returns empty array for null role', () => {
    expect(getUserPermissions(null)).toEqual([]);
  });

  it('returns empty array for undefined role', () => {
    expect(getUserPermissions(undefined)).toEqual([]);
  });

  it('returns empty array for role with empty permissions', () => {
    expect(getUserPermissions({ permissions: [] })).toEqual([]);
  });
});

// ── Role-based access matrix ───────────────────────────────────────

describe('Operator role access matrix', () => {
  it.each([
    ['super_admin', '/dashboard', true],
    ['super_admin', '/dashboard/users', true],
    ['super_admin', '/dashboard/finances', true],
    ['super_admin', '/dashboard/insurance', true],
    ['super_admin', '/dashboard/analytics', true],
    ['super_admin', '/dashboard/settings', true],

    ['insurance_ops', '/dashboard', true],
    ['insurance_ops', '/dashboard/users', true],
    ['insurance_ops', '/dashboard/finances', false],
    ['insurance_ops', '/dashboard/insurance', true],
    ['insurance_ops', '/dashboard/analytics', false],

    ['support', '/dashboard', true],
    ['support', '/dashboard/users', true],
    ['support', '/dashboard/finances', false],
    ['support', '/dashboard/insurance', false],

    ['analytics', '/dashboard', true],
    ['analytics', '/dashboard/analytics', true],
    ['analytics', '/dashboard/users', false],
    ['analytics', '/dashboard/finances', false],

    ['partner_manager', '/dashboard', true],
    ['partner_manager', '/dashboard/users', true],
    ['partner_manager', '/dashboard/finances', true],
    ['partner_manager', '/dashboard/insurance', false],

    ['finance_auditor', '/dashboard', true],
    ['finance_auditor', '/dashboard/finances', true],
    ['finance_auditor', '/dashboard/users', false],

    ['readonly_viewer', '/dashboard', true],
    ['readonly_viewer', '/dashboard/users', true],
    ['readonly_viewer', '/dashboard/finances', true],
    ['readonly_viewer', '/dashboard/insurance', true],
    ['readonly_viewer', '/dashboard/analytics', true],
    ['readonly_viewer', '/dashboard/settings', true],
  ])('%s can access %s → %s', (role, route, expected) => {
    const perms = ROLES[role].permissions;
    expect(canAccessRoute(perms, route)).toBe(expected);
  });
});
