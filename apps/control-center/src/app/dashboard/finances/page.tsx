'use client';

import { useState } from 'react';
import { Search, Filter, ArrowUpDown } from 'lucide-react';
import Table, { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import { formatCurrency, formatCurrencyCompact, formatDateTime } from '@/lib/utils';
import { Wallet, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Transaction, TransactionType, TransactionStatus } from '@/types';

const mockTransactions: Transaction[] = [
  { id: 't1', user_id: '1', type: 'contribution', amount_paise: 500000, status: 'completed', description: 'Monthly salary deduction', reference_id: 'TXN-20260318-001', created_at: '2026-03-18T10:30:00Z' },
  { id: 't2', user_id: '2', type: 'premium_payment', amount_paise: 1500000, status: 'completed', description: 'Annual premium - Star Health', reference_id: 'TXN-20260318-002', created_at: '2026-03-18T09:15:00Z' },
  { id: 't3', user_id: '3', type: 'contribution', amount_paise: 200000, status: 'pending', description: 'Self contribution via UPI', reference_id: 'TXN-20260317-003', created_at: '2026-03-17T16:45:00Z' },
  { id: 't4', user_id: '4', type: 'claim_payout', amount_paise: 2500000, status: 'completed', description: 'Claim payout - Apollo Hospital', reference_id: 'TXN-20260317-004', created_at: '2026-03-17T14:20:00Z' },
  { id: 't5', user_id: '5', type: 'withdrawal', amount_paise: 300000, status: 'failed', description: 'HSA withdrawal to bank', reference_id: 'TXN-20260317-005', created_at: '2026-03-17T11:00:00Z' },
  { id: 't6', user_id: '6', type: 'contribution', amount_paise: 500000, status: 'completed', description: 'Monthly salary deduction', reference_id: 'TXN-20260316-006', created_at: '2026-03-16T10:00:00Z' },
  { id: 't7', user_id: '7', type: 'refund', amount_paise: 150000, status: 'completed', description: 'Premium refund - cancelled policy', reference_id: 'TXN-20260316-007', created_at: '2026-03-16T08:30:00Z' },
  { id: 't8', user_id: '1', type: 'contribution', amount_paise: 300000, status: 'completed', description: 'Employer match contribution', reference_id: 'TXN-20260315-008', created_at: '2026-03-15T12:00:00Z' },
];

const statusBadge: Record<TransactionStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  failed: 'error',
  reversed: 'neutral',
};

const typeLabel: Record<TransactionType, string> = {
  contribution: 'Contribution',
  withdrawal: 'Withdrawal',
  premium_payment: 'Premium Payment',
  claim_payout: 'Claim Payout',
  refund: 'Refund',
  fee: 'Fee',
};

type TxRow = Transaction & Record<string, unknown>;

export default function FinancesPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | ''>('');
  const [page, setPage] = useState(1);

  const filtered = mockTransactions.filter((t) => {
    const matchSearch = !search || t.description.toLowerCase().includes(search.toLowerCase()) || t.reference_id.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || t.type === typeFilter;
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const totalVolume = mockTransactions.reduce((sum, t) => sum + t.amount_paise, 0);
  const completedVolume = mockTransactions.filter((t) => t.status === 'completed').reduce((sum, t) => sum + t.amount_paise, 0);
  const failedCount = mockTransactions.filter((t) => t.status === 'failed').length;

  const columns: Column<TxRow>[] = [
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="text-gray-600">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'reference_id',
      header: 'Reference',
      render: (row) => <span className="font-mono text-xs text-gray-500">{row.reference_id}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => <span className="text-gray-700">{typeLabel[row.type]}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <span className="text-gray-700">{row.description}</span>,
    },
    {
      key: 'amount_paise',
      header: 'Amount',
      sortable: true,
      render: (row) => <span className="font-medium text-gray-900">{formatCurrency(row.amount_paise)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={statusBadge[row.status]}>{row.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Volume Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total Volume (this period)"
          value={formatCurrencyCompact(totalVolume)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Completed Volume"
          value={formatCurrencyCompact(completedVolume)}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Failed Transactions"
          value={failedCount.toString()}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by description or reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | '')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">All Types</option>
            <option value="contribution">Contribution</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="premium_payment">Premium Payment</option>
            <option value="claim_payout">Claim Payout</option>
            <option value="refund">Refund</option>
            <option value="fee">Fee</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TransactionStatus | '')}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <Table<TxRow>
        columns={columns}
        data={filtered as TxRow[]}
        keyExtractor={(row) => row.id}
        page={page}
        totalPages={Math.ceil(filtered.length / 10)}
        onPageChange={setPage}
      />
    </div>
  );
}
