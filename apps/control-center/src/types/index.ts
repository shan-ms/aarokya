export type UserType = 'individual' | 'family' | 'employer' | 'admin' | 'operator';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export type TransactionType =
  | 'contribution'
  | 'withdrawal'
  | 'premium_payment'
  | 'claim_payout'
  | 'refund'
  | 'fee';

export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed';

export type ClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'paid_out';

export type PolicyStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export type ContributionSource = 'salary_deduction' | 'self_contribution' | 'employer_match' | 'government_subsidy';

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  user_type: UserType;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  kyc_verified: boolean;
  aadhaar_linked: boolean;
}

export interface HSAAccount {
  id: string;
  user_id: string;
  balance_paise: number;
  total_contributions_paise: number;
  total_withdrawals_paise: number;
  created_at: string;
  updated_at: string;
}

export interface Contribution {
  id: string;
  hsa_account_id: string;
  amount_paise: number;
  source: ContributionSource;
  status: TransactionStatus;
  created_at: string;
  reference_id: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount_paise: number;
  status: TransactionStatus;
  description: string;
  reference_id: string;
  created_at: string;
}

export interface InsurancePolicy {
  id: string;
  user_id: string;
  provider: string;
  plan_name: string;
  premium_paise: number;
  coverage_paise: number;
  status: PolicyStatus;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface Claim {
  id: string;
  policy_id: string;
  user_id: string;
  amount_paise: number;
  status: ClaimStatus;
  description: string;
  hospital_name?: string;
  diagnosis?: string;
  submitted_at: string;
  reviewed_at?: string;
  reviewer_id?: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: string[];
  created_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  avatar_url?: string;
}

export interface DashboardStats {
  total_users: number;
  total_hsa_value_paise: number;
  daily_contributions_paise: number;
  active_policies: number;
  user_growth_percent: number;
  hsa_growth_percent: number;
  contribution_growth_percent: number;
  policy_growth_percent: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, string[]>;
}
