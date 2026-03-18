'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Filter, Eye } from 'lucide-react';
import Table, { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { User, UserType, UserStatus } from '@/types';

// Mock data
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
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<UserType | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);

  const filtered = mockUsers.filter((u) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.phone.includes(search);
    const matchType = !typeFilter || u.user_type === typeFilter;
    const matchStatus = !statusFilter || u.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

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
        <Link href={`/dashboard/users/${row.id}`}>
          <Button variant="ghost" size="sm" icon={<Eye className="h-4 w-4" />}>
            View
          </Button>
        </Link>
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
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as UserType | '')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">All Types</option>
            <option value="individual">Individual</option>
            <option value="family">Family</option>
            <option value="employer">Employer</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
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

      {/* Table */}
      <Table<UserRow>
        columns={columns}
        data={filtered as UserRow[]}
        keyExtractor={(row) => row.id}
        page={page}
        totalPages={Math.ceil(filtered.length / 10)}
        onPageChange={setPage}
      />
    </div>
  );
}
