'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Save, Plus, Shield } from 'lucide-react';
import type { Role } from '@/types';

const mockRoles: Role[] = [
  { id: 'r1', name: 'Super Admin', permissions: ['all'], created_at: '2025-01-01T10:00:00Z' },
  { id: 'r2', name: 'Operations Manager', permissions: ['users.read', 'users.write', 'finances.read', 'insurance.read', 'insurance.write', 'analytics.read'], created_at: '2025-01-01T10:00:00Z' },
  { id: 'r3', name: 'Finance Analyst', permissions: ['finances.read', 'analytics.read', 'users.read'], created_at: '2025-03-15T10:00:00Z' },
  { id: 'r4', name: 'Claims Reviewer', permissions: ['insurance.read', 'insurance.write', 'users.read'], created_at: '2025-06-01T10:00:00Z' },
  { id: 'r5', name: 'Viewer', permissions: ['users.read', 'finances.read', 'insurance.read', 'analytics.read'], created_at: '2025-06-01T10:00:00Z' },
];

export default function SettingsPage() {
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:8080/api/v1');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [otpExpiry, setOtpExpiry] = useState('5');
  const [maxLoginAttempts, setMaxLoginAttempts] = useState('5');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, save via API
    console.log('Saving config:', { apiBaseUrl, sessionTimeout, otpExpiry, maxLoginAttempts, maintenanceMode });
  };

  return (
    <div className="space-y-6">
      {/* Roles Table */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="section-title">Roles & Permissions</h3>
          </div>
          <Button size="sm" icon={<Plus className="h-4 w-4" />}>
            Add Role
          </Button>
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
              {mockRoles.map((role) => (
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
                    <Button variant="ghost" size="sm">Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Configuration */}
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
            <Button type="submit" icon={<Save className="h-4 w-4" />}>
              Save Configuration
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
