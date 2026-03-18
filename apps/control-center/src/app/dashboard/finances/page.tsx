'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Calendar } from 'lucide-react';
import Table, { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatCurrency, formatCurrencyCompact, formatDateTime } from '@/lib/utils';
import { fetchTransactions } from '@/lib/services';
import { Wallet, TrendingUp, AlertTriangle } from 'lucide-react';
import type { Transaction, TransactionType, TransactionStatus } from '@/types';

const mockTransactions: (Transaction & { reconciliation_status?: string })[] = [
  { id: 't1', user_id: '1', type: 'contribution', amount_paise: 500000, status: 'completed', description: 'Monthly salary deduction', reference_id: 'TXN-20260318-001', created_at: '2026-03-18T10:30:00Z', reconciliation_status: 'reconciled' },
  { id: 't2', user_id: '2', type: 'premium_payment', amount_paise: 1500000, status: 'completed', description: 'Annual premium - Star Health', reference_id: 'TXN-20260318-002', created_at: '2026-03-18T09:15:00Z', reconciliation_status: 'reconciled' },
  { id: 't3', user_id: '3', type: 'contribution', amount_paise: 200000, status: 'pending', description: 'Self contribution via UPI', reference_id: 'TXN-20260317-003', created_at: '2026-03-17T16:45:00Z', reconciliation_status: 'pending' },
  { id: 't4', user_id: '4', type: 'claim_payout', amount_paise: 2500000, status: 'completed', description: 'Claim payout - Apollo Hospital', reference_id: 'TXN-20260317-004', created_at: '2026-03-17T14:20:00Z', reconciliation_status: 'reconciled' },
  { id: 't5', user_id: '5', type: 'withdrawal', amount_paise: 300000, status: 'failed', description: 'HSA withdrawal to bank', reference_id: 'TXN-20260317-005', created_at: '2026-03-17T11:00:00Z', reconciliation_status: 'flagged' },
  { id: 't6', user_id: '6', type: 'contribution', amount_paise: 500000, status: 'completed', description: 'Monthly salary deduction', reference_id: 'TXN-20260316-006', created_at: '2026-03-16T10:00:00Z', reconciliation_status: 'reconciled' },
  { id: 't7', user_id: '7', type: 'refund', amount_paise: 150000, status: 'completed', description: 'Premium refund - cancelled policy', reference_id: 'TXN-20260316-007', created_at: '2026-03-16T08:30:00Z', reconciliation_status: 'pending' },
  { id: 't8', user_id: '1', type: 'contribution', amount_paise: 300000, status: 'completed', description: 'Employer match contribution', reference_id: 'TXN-20260315-008', created_at: '2026-03-15T12:00:00Z', reconciliation_status: 'reconciled' },
];

const statusBadge: Record<TransactionStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success',
  pending: 'warning',
  failed: 'error',
  reversed: 'neutral',
};

const reconBadge: Record<string, 'success' | 'warning' | 'error'> = {
  reconciled: 'success',
  pending: 'warning',
  flagged: 'error',
};

const typeLabel: Record<TransactionType, string> = {
  contribution: 'Contribution',
  withdrawal: 'Withdrawal',
  premium_payment: 'Premium Payment',
  claim_payout: 'Claim Payout',
  refund: 'Refund',
  fee: 'Fee',
};

type TxRow = Transaction & { reconciliation_status?: string } & Record<string, unknown>;

export default function FinancesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<(Transaction & { reconciliation_status?: string })[]>(mockTransactions);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 10;

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTransactions({
        page,
        page_size: pageSize,
        search: search || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        amount_min: amountMin ? parseInt(amountMin) * 100 : undefined,
        amount_max: amountMax ? parseInt(amountMax) * 100 : undefined,
      });
      setTransactions(res.data);
      setTotalPages(res.total_pages);
    } catch {
      // Fall back to client-side filtering
      const filtered = mockTransactions.filter((t) => {
        const matchSearch = !search || t.description.toLowerCase().includes(search.toLowerCase()) || t.reference_id.toLowerCase().includes(search.toLowerCase());
        const matchType = !typeFilter || t.type === typeFilter;
        const matchStatus = !statusFilter || t.status === statusFilter;
        const matchAmountMin = !amountMin || t.amount_paise >= parseInt(amountMin) * 100;
        const matchAmountMax = !amountMax || t.amount_paise <= parseInt(amountMax) * 100;
        const matchDateFrom = !dateFrom || t.created_at >= dateFrom;
        const matchDateTo = !dateTo || t.created_at <= dateTo + 'T23:59:59Z';
        return matchSearch && matchType && matchStatus && matchAmountMin && matchAmountMax && matchDateFrom && matchDateTo;
      });
      setTransactions(filtered);
      setTotalPages(Math.max(1, Math.ceil(filtered.length / pageSize)));
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter, dateFrom, dateTo, amountMin, amountMax]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const totalVolume = transactions.reduce((sum, t) => sum + t.amount_paise, 0);
  const completedVolume = transactions.filter((t) => t.status === 'completed').reduce((sum, t) => sum + t.amount_paise, 0);
  const failedCount = transactions.filter((t) => t.status === 'failed').length;

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
      render: (row) => <span className="text-gray-700 max-w-[200px] truncate block">{row.description}</span>,
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
    {
      key: 'reconciliation_status',
      header: 'Reconciliation',
      render: (row) => {
        const recon = (row as TxRow).reconciliation_status || 'pending';
        return (
          <Badge variant={reconBadge[recon] || 'neutral'}>
            {recon}
          </Badge>
        );
      },
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
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search description or ref..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>

          {/* Type dropdown */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as TransactionType | ''); setPage(1); }}
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

          {/* Status dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as TransactionStatus | ''); setPage(1); }}
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>

        {/* Date range and amount range */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Min Amount (Rs)</label>
            <input
              type="number"
              placeholder="0"
              value={amountMin}
              onChange={(e) => { setAmountMin(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Max Amount (Rs)</label>
            <input
              type="number"
              placeholder="999999"
              value={amountMax}
              onChange={(e) => { setAmountMax(e.target.value); setPage(1); }}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <Table<TxRow>
        columns={columns}
        data={transactions as TxRow[]}
        keyExtractor={(row) => row.id}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
      />

      {/* Totals Summary Row */}
      {transactions.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Totals Summary</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">Total Transactions</p>
              <p className="text-lg font-bold text-gray-900">{transactions.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Value</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(totalVolume)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg Transaction</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(transactions.length > 0 ? Math.round(totalVolume / transactions.length) : 0)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Reconciled</p>
              <p className="text-lg font-bold text-secondary">
                {transactions.filter((t) => (t as Transaction & { reconciliation_status?: string }).reconciliation_status === 'reconciled').length} / {transactions.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
