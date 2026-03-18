import api from './api';
import type {
  User,
  HSAAccount,
  Contribution,
  Transaction,
  InsurancePolicy,
  Claim,
  DashboardStats,
  ChartDataPoint,
  PaginatedResponse,
  Role,
  AdminUser,
} from '@/types';

// ─── Auth ────────────────────────────────────────────────────────────
export async function requestOtp(phone: string): Promise<void> {
  await api.post('/auth/request-otp', { phone });
}

export async function verifyOtp(phone: string, otp: string): Promise<{ access_token: string; user: AdminUser }> {
  const res = await api.post('/auth/verify-otp', { phone, otp });
  return res.data;
}

// ─── Dashboard ───────────────────────────────────────────────────────
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await api.get('/admin/dashboard/stats');
  return res.data;
}

export async function fetchUserGrowthChart(): Promise<ChartDataPoint[]> {
  const res = await api.get('/admin/dashboard/user-growth');
  return res.data;
}

export async function fetchContributionChart(): Promise<ChartDataPoint[]> {
  const res = await api.get('/admin/dashboard/contribution-trend');
  return res.data;
}

export async function fetchSourceDistribution(): Promise<{ name: string; value: number }[]> {
  const res = await api.get('/admin/dashboard/source-distribution');
  return res.data;
}

export async function fetchRecentActivity(): Promise<{ id: string; action: string; user: string; time: string; type: string }[]> {
  const res = await api.get('/admin/dashboard/recent-activity');
  return res.data;
}

// ─── Users ───────────────────────────────────────────────────────────
export async function fetchUsers(params: {
  page?: number;
  page_size?: number;
  search?: string;
  user_type?: string;
  status?: string;
}): Promise<PaginatedResponse<User & { hsa_balance_paise: number }>> {
  const res = await api.get('/admin/users', { params });
  return res.data;
}

export async function fetchUserById(id: string): Promise<User> {
  const res = await api.get(`/admin/users/${id}`);
  return res.data;
}

export async function fetchUserHSA(userId: string): Promise<HSAAccount> {
  const res = await api.get(`/admin/users/${userId}/hsa`);
  return res.data;
}

export async function fetchUserContributions(userId: string): Promise<Contribution[]> {
  const res = await api.get(`/admin/users/${userId}/contributions`);
  return res.data;
}

export async function fetchUserPolicies(userId: string): Promise<InsurancePolicy[]> {
  const res = await api.get(`/admin/users/${userId}/policies`);
  return res.data;
}

export async function fetchUserClaims(userId: string): Promise<Claim[]> {
  const res = await api.get(`/admin/users/${userId}/claims`);
  return res.data;
}

export async function verifyUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/verify`);
}

export async function rejectUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/reject`);
}

export async function suspendUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/suspend`);
}

export async function activateUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/activate`);
}

// ─── Transactions / Finances ─────────────────────────────────────────
export async function fetchTransactions(params: {
  page?: number;
  page_size?: number;
  search?: string;
  type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
}): Promise<PaginatedResponse<Transaction & { reconciliation_status?: string }>> {
  const res = await api.get('/admin/transactions', { params });
  return res.data;
}

// ─── Insurance ───────────────────────────────────────────────────────
export async function fetchPolicies(params: {
  page?: number;
  status?: string;
}): Promise<PaginatedResponse<InsurancePolicy>> {
  const res = await api.get('/admin/insurance/policies', { params });
  return res.data;
}

export async function fetchClaims(params?: {
  page?: number;
  status?: string;
}): Promise<PaginatedResponse<Claim>> {
  const res = await api.get('/admin/insurance/claims', { params });
  return res.data;
}

export async function approveClaim(claimId: string, reason?: string): Promise<void> {
  await api.post(`/admin/insurance/claims/${claimId}/approve`, { reason });
}

export async function rejectClaim(claimId: string, reason: string): Promise<void> {
  await api.post(`/admin/insurance/claims/${claimId}/reject`, { reason });
}

export async function fetchInsuranceProviders(): Promise<{ id: string; name: string; policies_count: number; active_count: number }[]> {
  const res = await api.get('/admin/insurance/providers');
  return res.data;
}

// ─── Analytics ───────────────────────────────────────────────────────
export async function fetchAnalyticsUserGrowth(dateFrom?: string, dateTo?: string): Promise<ChartDataPoint[]> {
  const res = await api.get('/admin/analytics/user-growth', { params: { date_from: dateFrom, date_to: dateTo } });
  return res.data;
}

export async function fetchAnalyticsContributionTrend(dateFrom?: string, dateTo?: string): Promise<ChartDataPoint[]> {
  const res = await api.get('/admin/analytics/contribution-trend', { params: { date_from: dateFrom, date_to: dateTo } });
  return res.data;
}

export async function fetchInsuranceFunnel(): Promise<{ label: string; count: number; percent: number }[]> {
  const res = await api.get('/admin/analytics/insurance-funnel');
  return res.data;
}

export async function fetchGeographicDistribution(): Promise<{ state: string; users: number }[]> {
  const res = await api.get('/admin/analytics/geographic-distribution');
  return res.data;
}

// ─── Settings / Roles ────────────────────────────────────────────────
export async function fetchRoles(): Promise<Role[]> {
  const res = await api.get('/admin/roles');
  return res.data;
}

export async function fetchOperators(): Promise<AdminUser[]> {
  const res = await api.get('/admin/operators');
  return res.data;
}

export async function inviteOperator(data: { name: string; email: string; phone: string; role_id: string }): Promise<void> {
  await api.post('/admin/operators/invite', data);
}

export async function updateRolePermissions(roleId: string, permissions: string[]): Promise<void> {
  await api.put(`/admin/roles/${roleId}/permissions`, { permissions });
}

export async function saveSystemConfig(config: Record<string, unknown>): Promise<void> {
  await api.put('/admin/settings/config', config);
}
