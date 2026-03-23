'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Phone, Mail, Calendar, Shield, CreditCard, UserX, UserCheck } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/store/authStore';
import { hasPermission, getUserPermissions } from '@/lib/rbac';
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils';
import {
  fetchUserById,
  fetchUserHSA,
  fetchUserContributions,
  fetchUserPolicies,
  fetchUserClaims,
  suspendUser,
  activateUser,
  verifyUser,
  rejectUser,
} from '@/lib/services';
import type { User, HSAAccount, Contribution, InsurancePolicy, Claim, TransactionStatus, ClaimStatus, PolicyStatus, ContributionSource } from '@/types';

// Fallback mock data
const mockUser: User = {
  id: '1', phone: '+919876543210', name: 'Priya Sharma', email: 'priya.sharma@email.com',
  user_type: 'individual', status: 'active', created_at: '2025-06-15T10:00:00Z',
  updated_at: '2026-03-01T12:00:00Z', kyc_verified: true, aadhaar_linked: true,
};
const mockHSA: HSAAccount = {
  id: 'hsa-1', user_id: '1', balance_paise: 4500000,
  total_contributions_paise: 6800000, total_withdrawals_paise: 2300000,
  created_at: '2025-06-15T10:00:00Z', updated_at: '2026-03-18T08:00:00Z',
};
const mockContributions: Contribution[] = [
  { id: 'c1', hsa_account_id: 'hsa-1', amount_paise: 500000, source: 'salary_deduction', status: 'completed', created_at: '2026-03-01T10:00:00Z', reference_id: 'REF001' },
  { id: 'c2', hsa_account_id: 'hsa-1', amount_paise: 500000, source: 'salary_deduction', status: 'completed', created_at: '2026-02-01T10:00:00Z', reference_id: 'REF002' },
  { id: 'c3', hsa_account_id: 'hsa-1', amount_paise: 200000, source: 'self_contribution', status: 'completed', created_at: '2026-01-15T10:00:00Z', reference_id: 'REF003' },
  { id: 'c4', hsa_account_id: 'hsa-1', amount_paise: 500000, source: 'salary_deduction', status: 'completed', created_at: '2026-01-01T10:00:00Z', reference_id: 'REF004' },
  { id: 'c5', hsa_account_id: 'hsa-1', amount_paise: 300000, source: 'employer_match', status: 'completed', created_at: '2025-12-01T10:00:00Z', reference_id: 'REF005' },
];
const mockPolicies: InsurancePolicy[] = [
  { id: 'p1', user_id: '1', provider: 'Star Health', plan_name: 'Family Floater Plus', premium_paise: 1500000, coverage_paise: 50000000, status: 'active', start_date: '2025-08-01', end_date: '2026-07-31', created_at: '2025-08-01T10:00:00Z' },
];
const mockClaims: Claim[] = [
  { id: 'cl1', policy_id: 'p1', user_id: '1', amount_paise: 2500000, status: 'paid_out', description: 'Hospitalization', hospital_name: 'Apollo Hospital', diagnosis: 'Dengue fever', submitted_at: '2025-11-10T10:00:00Z', reviewed_at: '2025-11-12T14:00:00Z', reviewer_id: 'admin-1' },
];

const txStatusBadge: Record<TransactionStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success', pending: 'warning', failed: 'error', reversed: 'neutral',
};
const claimStatusBadge: Record<ClaimStatus, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
  submitted: 'info', under_review: 'warning', approved: 'success', rejected: 'error', paid_out: 'success',
};
const policyStatusBadge: Record<PolicyStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success', expired: 'neutral', cancelled: 'error', pending: 'warning',
};
const sourceLabel: Record<ContributionSource, string> = {
  salary_deduction: 'Salary Deduction', self_contribution: 'Self Contribution',
  employer_match: 'Employer Match', government_subsidy: 'Govt Subsidy',
};

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;
  const { toast } = useToast();
  const authUser = useAuthStore((s) => s.user);
  const permissions = getUserPermissions(authUser?.role);
  const canWrite = hasPermission(permissions, 'users.write');

  const [user, setUser] = useState<User>(mockUser);
  const [hsa, setHsa] = useState<HSAAccount>(mockHSA);
  const [contributions, setContributions] = useState<Contribution[]>(mockContributions);
  const [policies, setPolicies] = useState<InsurancePolicy[]>(mockPolicies);
  const [claims, setClaims] = useState<Claim[]>(mockClaims);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadUser() {
      try {
        const [userRes, hsaRes, contribRes, polRes, claimRes] = await Promise.allSettled([
          fetchUserById(userId),
          fetchUserHSA(userId),
          fetchUserContributions(userId),
          fetchUserPolicies(userId),
          fetchUserClaims(userId),
        ]);
        if (!mounted) return;
        if (userRes.status === 'fulfilled') setUser(userRes.value);
        if (hsaRes.status === 'fulfilled') setHsa(hsaRes.value);
        if (contribRes.status === 'fulfilled') setContributions(contribRes.value);
        if (polRes.status === 'fulfilled') setPolicies(polRes.value);
        if (claimRes.status === 'fulfilled') setClaims(claimRes.value);
      } catch {
        // keep mock data
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadUser();
    return () => { mounted = false; };
  }, [userId]);

  const handleSuspend = async () => {
    setActionLoading(true);
    try {
      await suspendUser(userId);
      setUser((u) => ({ ...u, status: 'suspended' }));
      toast('success', 'User Suspended', `${user.name} has been suspended.`);
    } catch {
      toast('error', 'Action Failed', 'Could not suspend user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      await activateUser(userId);
      setUser((u) => ({ ...u, status: 'active' }));
      toast('success', 'User Activated', `${user.name} has been activated.`);
    } catch {
      toast('error', 'Action Failed', 'Could not activate user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    setActionLoading(true);
    try {
      await verifyUser(userId);
      setUser((u) => ({ ...u, status: 'active', kyc_verified: true }));
      toast('success', 'User Verified', `${user.name} has been verified.`);
    } catch {
      toast('error', 'Verification Failed', 'Could not verify user.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await rejectUser(userId);
      setUser((u) => ({ ...u, status: 'inactive' }));
      toast('success', 'User Rejected', `${user.name} verification was rejected.`);
    } catch {
      toast('error', 'Rejection Failed', 'Could not reject user.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-gray-500">Loading user details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/dashboard/users">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
          Back to Users
        </Button>
      </Link>

      {/* User Info Card */}
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <Badge variant={user.status === 'active' ? 'success' : user.status === 'suspended' ? 'error' : 'warning'}>
                {user.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="mt-3 space-y-1.5 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {formatPhone(user.phone)}
              </div>
              {user.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Joined {formatDate(user.created_at)}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Badge variant={user.kyc_verified ? 'success' : 'warning'}>
                {user.kyc_verified ? 'KYC Verified' : 'KYC Pending'}
              </Badge>
              <Badge variant={user.aadhaar_linked ? 'success' : 'neutral'}>
                {user.aadhaar_linked ? 'Aadhaar Linked' : 'Aadhaar Not Linked'}
              </Badge>
            </div>
            {/* Action buttons */}
            {canWrite && (
              <div className="flex gap-2 mt-2">
                {user.status === 'pending_verification' && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<UserCheck className="h-4 w-4" />}
                      onClick={handleVerify}
                      loading={actionLoading}
                    >
                      Verify
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<UserX className="h-4 w-4" />}
                      onClick={handleReject}
                      loading={actionLoading}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {user.status === 'active' && (
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<UserX className="h-4 w-4" />}
                    onClick={handleSuspend}
                    loading={actionLoading}
                  >
                    Suspend User
                  </Button>
                )}
                {(user.status === 'suspended' || user.status === 'inactive') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<UserCheck className="h-4 w-4" />}
                    onClick={handleActivate}
                    loading={actionLoading}
                  >
                    Activate User
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HSA Account */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="section-title">HSA Account</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-primary-50 p-4">
            <p className="text-sm text-primary-600">Current Balance</p>
            <p className="mt-1 text-2xl font-bold text-primary-700">{formatCurrency(hsa.balance_paise)}</p>
          </div>
          <div className="rounded-lg bg-secondary-50 p-4">
            <p className="text-sm text-secondary-600">Total Contributions</p>
            <p className="mt-1 text-2xl font-bold text-secondary-700">{formatCurrency(hsa.total_contributions_paise)}</p>
          </div>
          <div className="rounded-lg bg-accent-50 p-4">
            <p className="text-sm text-accent-600">Total Withdrawals</p>
            <p className="mt-1 text-2xl font-bold text-accent-700">{formatCurrency(hsa.total_withdrawals_paise)}</p>
          </div>
        </div>
      </div>

      {/* Contribution History */}
      <div className="card">
        <h3 className="section-title mb-4">Contribution History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Source</th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contributions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-gray-400">No contributions</td>
                </tr>
              ) : (
                contributions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-700">{formatDate(c.created_at)}</td>
                    <td className="py-3 font-medium text-gray-900">{formatCurrency(c.amount_paise)}</td>
                    <td className="py-3 text-gray-600">{sourceLabel[c.source]}</td>
                    <td className="py-3">
                      <Badge variant={txStatusBadge[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="py-3 font-mono text-xs text-gray-500">{c.reference_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insurance Policies */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="section-title">Insurance Policies</h3>
        </div>
        {policies.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No insurance policies</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Provider</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Plan</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Premium</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Coverage</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Period</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {policies.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{p.provider}</td>
                    <td className="py-3 text-gray-700">{p.plan_name}</td>
                    <td className="py-3 text-gray-700">{formatCurrency(p.premium_paise)}/yr</td>
                    <td className="py-3 font-medium text-gray-900">{formatCurrency(p.coverage_paise)}</td>
                    <td className="py-3 text-gray-500">{formatDate(p.start_date)} - {formatDate(p.end_date)}</td>
                    <td className="py-3">
                      <Badge variant={policyStatusBadge[p.status]}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claims History */}
      <div className="card">
        <h3 className="section-title mb-4">Claims History</h3>
        {claims.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No claims filed</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Hospital</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Diagnosis</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                  <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((cl) => (
                  <tr key={cl.id} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-700">{formatDate(cl.submitted_at)}</td>
                    <td className="py-3 text-gray-700">{cl.hospital_name || '-'}</td>
                    <td className="py-3 text-gray-700">{cl.diagnosis || '-'}</td>
                    <td className="py-3 font-medium text-gray-900">{formatCurrency(cl.amount_paise)}</td>
                    <td className="py-3">
                      <Badge variant={claimStatusBadge[cl.status]}>{cl.status.replace('_', ' ')}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
