'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, getUserPermissions, ALL_PERMISSIONS } from '@/lib/rbac';
import { Save, Plus, Shield, UserPlus } from 'lucide-react';
import {
  fetchRoles,
  fetchOperators,
  inviteOperator,
  updateRolePermissions,
  saveSystemConfig,
} from '@/lib/services';
import type { Role, AdminUser } from '@/types';

const mockRoles: Role[] = [
  { id: 'r1', name: 'Super Admin', permissions: ['all'], created_at: '2025-01-01T10:00:00Z' },
  { id: 'r2', name: 'Operations Manager', permissions: ['users.read', 'users.write', 'finances.read', 'insurance.read', 'insurance.write', 'analytics.read'], created_at: '2025-01-01T10:00:00Z' },
  { id: 'r3', name: 'Finance Analyst', permissions: ['finances.read', 'analytics.read', 'users.read'], created_at: '2025-03-15T10:00:00Z' },
  { id: 'r4', name: 'Claims Reviewer', permissions: ['insurance.read', 'insurance.write', 'users.read'], created_at: '2025-06-01T10:00:00Z' },
  { id: 'r5', name: 'Viewer', permissions: ['users.read', 'finances.read', 'insurance.read', 'analytics.read'], created_at: '2025-06-01T10:00:00Z' },
];

const mockOperators: AdminUser[] = [
  { id: 'op1', name: 'Admin User', email: 'admin@aarokya.in', phone: '+919999000001', role: mockRoles[0] },
  { id: 'op2', name: 'Ravi Operator', email: 'ravi@aarokya.in', phone: '+919999000002', role: mockRoles[1] },
  { id: 'op3', name: 'Finance Team', email: 'finance@aarokya.in', phone: '+919999000003', role: mockRoles[2] },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const authUser = useAuthStore((s) => s.user);
  const permissions = getUserPermissions(authUser?.role);
  const canWrite = hasPermission(permissions, 'settings.write');

  const [roles, setRoles] = useState<Role[]>(mockRoles);
  const [operators, setOperators] = useState<AdminUser[]>(mockOperators);
  const [loading, setLoading] = useState(true);

  // Config state
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:8080/api/v1');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [otpExpiry, setOtpExpiry] = useState('5');
  const [maxLoginAttempts, setMaxLoginAttempts] = useState('5');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviting, setInviting] = useState(false);

  // Permission edit modal
  const [permModal, setPermModal] = useState<{ open: boolean; role: Role | null }>({ open: false, role: null });
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [rolesRes, opsRes] = await Promise.allSettled([
          fetchRoles(),
          fetchOperators(),
        ]);
        if (!mounted) return;
        if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value);
        if (opsRes.status === 'fulfilled') setOperators(opsRes.value);
      } catch {
        // keep mock data
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await saveSystemConfig({
        api_base_url: apiBaseUrl,
        session_timeout: parseInt(sessionTimeout),
        otp_expiry: parseInt(otpExpiry),
        max_login_attempts: parseInt(maxLoginAttempts),
        maintenance_mode: maintenanceMode,
      });
      toast('success', 'Configuration Saved', 'System settings have been updated.');
    } catch {
      toast('error', 'Save Failed', 'Could not save system configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleInviteOperator = async () => {
    if (!inviteName || !inviteEmail || !invitePhone || !inviteRoleId) {
      toast('warning', 'Missing Fields', 'Please fill in all fields.');
      return;
    }
    setInviting(true);
    try {
      await inviteOperator({
        name: inviteName,
        email: inviteEmail,
        phone: `+91${invitePhone}`,
        role_id: inviteRoleId,
      });
      toast('success', 'Invitation Sent', `Invitation sent to ${inviteEmail}.`);
      setInviteModalOpen(false);
      setInviteName(''); setInviteEmail(''); setInvitePhone(''); setInviteRoleId('');
    } catch {
      toast('error', 'Invite Failed', 'Could not send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const openPermissionEdit = (role: Role) => {
    setPermModal({ open: true, role });
    setEditPermissions([...role.permissions]);
  };

  const togglePermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSavePermissions = async () => {
    if (!permModal.role) return;
    setSavingPerms(true);
    try {
      await updateRolePermissions(permModal.role.id, editPermissions);
      setRoles((prev) =>
        prev.map((r) => r.id === permModal.role!.id ? { ...r, permissions: editPermissions } : r)
      );
      toast('success', 'Permissions Updated', `Permissions for ${permModal.role.name} have been updated.`);
      setPermModal({ open: false, role: null });
    } catch {
      toast('error', 'Update Failed', 'Could not update permissions.');
    } finally {
      setSavingPerms(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Operators Table */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="section-title">Operators</h3>
          {canWrite && (
            <Button
              size="sm"
              icon={<UserPlus className="h-4 w-4" />}
              onClick={() => setInviteModalOpen(true)}
            >
              Invite Operator
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Phone</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operators.map((op) => (
                <tr key={op.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{op.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{op.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">{op.phone}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge variant="info">{op.role.name}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Roles & Permissions Table */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="section-title">Roles & Permissions</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Role Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Permissions</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{role.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.map((perm) => (
                        <Badge key={perm} variant="info">{perm}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {canWrite && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openPermissionEdit(role)}
                      >
                        Edit Permissions
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Configuration */}
      {canWrite && (
        <div className="card">
          <h3 className="section-title mb-4">System Configuration</h3>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="API Base URL"
                value={apiBaseUrl}
                onChange={(e) => setApiBaseUrl(e.target.value)}
                helperText="Backend API endpoint"
              />
              <Input
                label="Session Timeout (minutes)"
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                helperText="Auto-logout after inactivity"
              />
              <Input
                label="OTP Expiry (minutes)"
                type="number"
                value={otpExpiry}
                onChange={(e) => setOtpExpiry(e.target.value)}
                helperText="Time before OTP expires"
              />
              <Input
                label="Max Login Attempts"
                type="number"
                value={maxLoginAttempts}
                onChange={(e) => setMaxLoginAttempts(e.target.value)}
                helperText="Before account lockout"
              />
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-4">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-200" />
              </label>
              <div>
                <p className="text-sm font-medium text-gray-700">Maintenance Mode</p>
                <p className="text-xs text-gray-500">Disable public access while performing system updates</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" icon={<Save className="h-4 w-4" />} loading={savingConfig}>
                Save Configuration
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Invite Operator Modal */}
      <Modal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Operator"
        size="md"
        actions={
          <>
            <Button variant="outline" onClick={() => setInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleInviteOperator} loading={inviting}>
              Send Invitation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Enter full name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            placeholder="operator@aarokya.in"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <div className="flex items-end gap-2">
            <div className="flex h-[38px] items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
              +91
            </div>
            <div className="flex-1">
              <Input
                label="Phone Number"
                type="tel"
                placeholder="9876543210"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
            <select
              value={inviteRoleId}
              onChange={(e) => setInviteRoleId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            >
              <option value="">Select a role...</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>

      {/* Permission Edit Modal */}
      <Modal
        open={permModal.open}
        onClose={() => setPermModal({ open: false, role: null })}
        title={`Edit Permissions: ${permModal.role?.name || ''}`}
        size="md"
        actions={
          <>
            <Button variant="outline" onClick={() => setPermModal({ open: false, role: null })}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSavePermissions} loading={savingPerms}>
              Save Permissions
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-3">Toggle permissions for this role:</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ALL_PERMISSIONS.map((perm) => (
              <label
                key={perm}
                className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={editPermissions.includes('all') || editPermissions.includes(perm)}
                  onChange={() => togglePermission(perm)}
                  disabled={editPermissions.includes('all')}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary-200"
                />
                <span className="text-sm text-gray-700">{perm}</span>
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-lg border-2 border-primary-200 bg-primary-50 p-3 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={editPermissions.includes('all')}
              onChange={() => togglePermission('all')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary-200"
            />
            <span className="text-sm font-medium text-primary-700">All Permissions (Super Admin)</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
