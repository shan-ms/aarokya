'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Eye, CheckCircle, XCircle } from 'lucide-react';
import Table, { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, getUserPermissions } from '@/lib/rbac';
import { formatCurrency, formatDate } from '@/lib/utils';
import { fetchUsers, verifyUser, rejectUser } from '@/lib/services';
import type { User, UserType, UserStatus } from '@/types';

// Fallback mock data
const mockUsers: (User & { hsa_balance_paise: number })[] = [
  { id: '1', phone: '+919876543210', name: 'Priya Sharma', user_type: 'individual', status: 'active', created_at: '2025-06-15T10:00:00Z', updated_at: '2026-03-01T12:00:00Z', kyc_verified: true, aadhaar_linked: true, hsa_balance_paise: 4500000 },
  { id: '2', phone: '+919876543211', name: 'Rajesh Kumar', user_type: 'family', status: 'active', created_at: '2025-07-20T10:00:00Z', updated_at: '2026-03-10T12:00:00Z', kyc_verified: true, aadhaar_linked: true, hsa_balance_paise: 8200000 },
  { id: '3', phone: '+919876543212', name: 'Meena Devi', user_type: 'individual', status: 'pending_verification', created_at: '2026-02-28T10:00:00Z', updated_at: '2026-03-01T12:00:00Z', kyc_verified: false, aadhaar_linked: false, hsa_balance_paise: 0 },
  { id: '4', phone: '+919876543213', name: 'Amit Patel', user_type: 'employer', status: 'active', created_at: '2025-04-10T10:00:00Z', updated_at: '2026-02-15T12:00:00Z', kyc_verified: true, aadhaar_linked: true, hsa_balance_paise: 15000000 },
  { id: '5', phone: '+919876543214', name: 'Sunita Rao', user_type: 'individual', status: 'suspended', created_at: '2025-09-01T10:00:00Z', updated_at: '2026-01-20T12:00:00Z', kyc_verified: true, aadhaar_linked: false, hsa_balance_paise: 1200000 },
  { id: '6', phone: '+919876543215', name: 'Vikram Singh', user_type: 'individual', status: 'active', created_at: '2025-11-12T10:00:00Z', updated_at: '2026-03-15T12:00:00Z', kyc_verified: true, aadhaar_linked: true, hsa_balance_paise: 3200000 },
  { id: '7', phone: '+919876543216', name: 'Anita Deshmukh', user_type: 'family', status: 'active', created_at: '2025-08-05T10:00:00Z', updated_at: '2026-03-12T12:00:00Z', kyc_verified: true, aadhaar_linked: true, hsa_balance_paise: 6700000 },
  { id: '8', phone: '+919876543217', name: 'Sanjay Gupta', user_type: 'individual', status: 'inactive', created_at: '2025-05-22T10:00:00Z', updated_at: '2025-12-01T12:00:00Z', kyc_verified: true, aadhaar_linked: true, hsa_balance_paise: 890000 },
];

const statusBadge: Record<UserStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'error',
  pending_verification: 'warning',
};

const statusLabel: Record<UserStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  pending_verification: 'Pending',
};

type UserRow = User & { hsa_balance_paise: number } & Record<string, unknown>;

export default function UsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const authUser = useAuthStore((s) => s.user);
  const permissions = getUserPermissions(authUser?.role);
  const canWrite = hasPermission(permissions, 'users.write');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<UserType | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<(User & { hsa_balance_paise: number })[]>(mockUsers);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const pageSize = 10;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchUsers({
        page,
        page_size: pageSize,
        search: search || undefined,
        user_type: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setUsers(res.data);
      setTotalPages(res.total_pages);
    } catch {
      // Fall back to client-side filtering of mock data
      const filtered = mockUsers.filter((u) => {
        const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
        const matchType = !typeFilter || u.user_type === typeFilter;
        const matchStatus = !statusFilter || u.status === statusFilter;
        return matchSearch && matchType && matchStatus;
      });
      setUsers(filtered);
      setTotalPages(Math.max(1, Math.ceil(filtered.length / pageSize)));
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleVerify = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(userId);
    try {
      await verifyUser(userId);
      toast('success', 'User Verified', 'User has been verified successfully.');
      await loadUsers();
    } catch {
      toast('error', 'Verification Failed', 'Could not verify user.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading(userId);
    try {
      await rejectUser(userId);
      toast('success', 'User Rejected', 'User verification has been rejected.');
      await loadUsers();
    } catch {
      toast('error', 'Rejection Failed', 'Could not reject user.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRowClick = (row: UserRow) => {
    router.push(`/dashboard/users/${row.id}`);
  };

  const columns: Column<UserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span className="text-gray-600">{row.phone}</span>,
    },
    {
      key: 'user_type',
      header: 'Type',
      sortable: true,
      render: (row) => (
        <span className="capitalize text-gray-700">{row.user_type}</span>
      ),
    },
    {
      key: 'hsa_balance_paise',
      header: 'HSA Balance',
      sortable: true,
      render: (row) => <span className="font-medium">{formatCurrency(row.hsa_balance_paise)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={statusBadge[row.status]}>{statusLabel[row.status]}</Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      sortable: true,
      render: (row) => <span className="text-gray-500">{formatDate(row.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          {canWrite && row.status === 'pending_verification' && (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCircle className="h-3.5 w-3.5" />}
                loading={actionLoading === row.id}
                onClick={(e) => handleVerify(row.id, e)}
              >
                Verify
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<XCircle className="h-3.5 w-3.5" />}
                loading={actionLoading === row.id}
                onClick={(e) => handleReject(row.id, e)}
              >
                Reject
              </Button>
            </>
          )}
          <Link href={`/dashboard/users/${row.id}`} onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}>
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as UserType | ''); setPage(1); }}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">All Types</option>
            <option value="individual">Individual</option>
            <option value="family">Family</option>
            <option value="employer">Employer</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as UserStatus | ''); setPage(1); }}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="pending_verification">Pending</option>
          </select>
        </div>
      </div>

      {/* Clickable row table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleRowClick(row as UserRow)}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {col.render ? col.render(row as UserRow) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
