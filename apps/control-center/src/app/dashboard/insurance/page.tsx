'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle, XCircle } from 'lucide-react';
import type { InsurancePolicy, Claim, PolicyStatus, ClaimStatus } from '@/types';

const mockPolicies: InsurancePolicy[] = [
  { id: 'p1', user_id: '1', provider: 'Star Health', plan_name: 'Family Floater Plus', premium_paise: 1500000, coverage_paise: 50000000, status: 'active', start_date: '2025-08-01', end_date: '2026-07-31', created_at: '2025-08-01T10:00:00Z' },
  { id: 'p2', user_id: '2', provider: 'HDFC Ergo', plan_name: 'Optima Secure', premium_paise: 1200000, coverage_paise: 30000000, status: 'active', start_date: '2025-09-15', end_date: '2026-09-14', created_at: '2025-09-15T10:00:00Z' },
  { id: 'p3', user_id: '4', provider: 'ICICI Lombard', plan_name: 'Health Booster', premium_paise: 800000, coverage_paise: 20000000, status: 'expired', start_date: '2024-12-01', end_date: '2025-11-30', created_at: '2024-12-01T10:00:00Z' },
  { id: 'p4', user_id: '6', provider: 'Max Bupa', plan_name: 'GoActive', premium_paise: 950000, coverage_paise: 25000000, status: 'active', start_date: '2026-01-01', end_date: '2026-12-31', created_at: '2026-01-01T10:00:00Z' },
  { id: 'p5', user_id: '7', provider: 'Star Health', plan_name: 'Comprehensive', premium_paise: 2000000, coverage_paise: 100000000, status: 'pending', start_date: '2026-04-01', end_date: '2027-03-31', created_at: '2026-03-15T10:00:00Z' },
];

const mockClaims: Claim[] = [
  { id: 'cl1', policy_id: 'p1', user_id: '1', amount_paise: 2500000, status: 'paid_out', description: 'Hospitalization - Dengue', hospital_name: 'Apollo Hospital', diagnosis: 'Dengue fever', submitted_at: '2025-11-10T10:00:00Z', reviewed_at: '2025-11-12T14:00:00Z', reviewer_id: 'admin-1' },
  { id: 'cl2', policy_id: 'p2', user_id: '2', amount_paise: 1800000, status: 'under_review', description: 'Surgery - Appendectomy', hospital_name: 'Fortis Hospital', diagnosis: 'Appendicitis', submitted_at: '2026-03-15T10:00:00Z' },
  { id: 'cl3', policy_id: 'p4', user_id: '6', amount_paise: 500000, status: 'submitted', description: 'OPD treatment', hospital_name: 'Max Hospital', diagnosis: 'Fracture', submitted_at: '2026-03-17T10:00:00Z' },
  { id: 'cl4', policy_id: 'p1', user_id: '1', amount_paise: 3200000, status: 'submitted', description: 'Hospitalization - Cardiac', hospital_name: 'AIIMS', diagnosis: 'Cardiac evaluation', submitted_at: '2026-03-18T08:00:00Z' },
  { id: 'cl5', policy_id: 'p2', user_id: '2', amount_paise: 750000, status: 'rejected', description: 'Dental procedure', hospital_name: 'Dental Clinic', diagnosis: 'Root canal', submitted_at: '2026-02-20T10:00:00Z', reviewed_at: '2026-02-22T11:00:00Z', reviewer_id: 'admin-2' },
];

const policyStatusBadge: Record<PolicyStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  expired: 'neutral',
  cancelled: 'error',
  pending: 'warning',
};

const claimStatusBadge: Record<ClaimStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  submitted: 'info',
  under_review: 'warning',
  approved: 'success',
  rejected: 'error',
  paid_out: 'success',
};

export default function InsurancePage() {
  const [activeTab, setActiveTab] = useState<'policies' | 'claims'>('policies');

  const pendingClaims = mockClaims.filter((c) => c.status === 'submitted' || c.status === 'under_review');

  const handleApproveClaim = (claimId: string) => {
    // In production, call API
    console.log('Approve claim:', claimId);
  };

  const handleRejectClaim = (claimId: string) => {
    // In production, call API
    console.log('Reject claim:', claimId);
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('policies')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'policies'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Policies
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'claims'
              ? 'border-b-2 border-primary text-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Claims
          {pendingClaims.length > 0 && (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
              {pendingClaims.length}
            </span>
          )}
        </button>
      </div>

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Provider</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Plan</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Premium</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Coverage</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Period</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mockPolicies.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{p.provider}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{p.plan_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatCurrency(p.premium_paise)}/yr</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{formatCurrency(p.coverage_paise)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {formatDate(p.start_date)} - {formatDate(p.end_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant={policyStatusBadge[p.status]}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Claims Tab */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {/* Claims Review Queue */}
          {pendingClaims.length > 0 && (
            <div className="card border-accent-200 bg-accent-50/30">
              <h3 className="section-title mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                Review Queue ({pendingClaims.length})
              </h3>
              <div className="space-y-3">
                {pendingClaims.map((claim) => (
                  <div key={claim.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{claim.description}</p>
                        <Badge variant={claimStatusBadge[claim.status]}>{claim.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {claim.hospital_name} | {claim.diagnosis} | Submitted {formatDate(claim.submitted_at)}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(claim.amount_paise)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<CheckCircle className="h-4 w-4" />}
                        onClick={() => handleApproveClaim(claim.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<XCircle className="h-4 w-4" />}
                        onClick={() => handleRejectClaim(claim.id)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Claims Table */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Submitted</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Description</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Hospital</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Diagnosis</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mockClaims.map((cl) => (
                    <tr key={cl.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(cl.submitted_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{cl.description}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{cl.hospital_name || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">{cl.diagnosis || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{formatCurrency(cl.amount_paise)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge variant={claimStatusBadge[cl.status]}>{cl.status.replace('_', ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
