/**
 * Role-based access control helpers for the control center.
 *
 * Operator roles (from CLAUDE.md):
 *   super_admin, insurance_ops, support, analytics, partner_manager
 *
 * Permission scheme:
 *   <module>.<action>  e.g. users.read, users.write, finances.read, insurance.write
 *   The special permission "all" grants everything.
 */

export const ALL_PERMISSIONS = [
  'users.read',
  'users.write',
  'finances.read',
  'finances.write',
  'insurance.read',
  'insurance.write',
  'analytics.read',
  'settings.read',
  'settings.write',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number] | 'all';

/**
 * Sidebar items that should be visible per permission.
 */
export const SIDEBAR_PERMISSIONS: Record<string, Permission[]> = {
  '/dashboard': [], // everyone
  '/dashboard/users': ['users.read'],
  '/dashboard/finances': ['finances.read'],
  '/dashboard/insurance': ['insurance.read'],
  '/dashboard/analytics': ['analytics.read'],
  '/dashboard/settings': ['settings.read'],
};

/**
 * Check if a set of user permissions satisfies the required permissions.
 */
export function hasPermission(userPermissions: string[], required: Permission | Permission[]): boolean {
  if (userPermissions.includes('all')) return true;
  const reqs = Array.isArray(required) ? required : [required];
  return reqs.every((r) => userPermissions.includes(r));
}

/**
 * Check if a sidebar item should be visible for the given permissions.
 */
export function canAccessRoute(userPermissions: string[], route: string): boolean {
  const required = SIDEBAR_PERMISSIONS[route];
  if (!required || required.length === 0) return true;
  return hasPermission(userPermissions, required);
}

/**
 * Get the list of permissions for a user from their role.
 * Falls back to read-only if no role info.
 */
export function getUserPermissions(role: { permissions: string[] } | null | undefined): string[] {
  if (!role) return [];
  return role.permissions;
}
