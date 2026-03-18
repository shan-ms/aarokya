/**
 * Aarokya Shared Types
 * Common TypeScript interfaces used across customer app, partner app, and control center.
 * All monetary values are in paise (1/100 of ₹).
 */

// ==================== Users ====================

export type UserType = 'customer' | 'partner' | 'operator';

export type OperatorRole =
  | 'super_admin'
  | 'insurance_ops'
  | 'support'
  | 'analytics'
  | 'partner_manager';

export interface User {
  id: string;
  phone: string;
  abha_id?: string;
  name?: string;
  email?: string;
  user_type: UserType;
  language?: string;
  status?: string;
  created_at: string;
  updated_at: string;
}

// ==================== Auth ====================

export interface SendOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: User;
}

// ==================== Health Savings Account ====================

export interface HealthSavingsAccount {
  id: string;
  user_id: string;
  abha_id: string;
  balance_paise: number;
  total_contributed_paise: number;
  insurance_eligible: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface HsaDashboard {
  balance_paise: number;
  total_contributed_paise: number;
  insurance_eligible: boolean;
  basic_insurance_progress: number; // 0.0 to 1.0 (threshold: ₹3,999)
  premium_insurance_progress: number; // 0.0 to 1.0 (threshold: ₹10,000)
  contribution_count: number;
}

export interface CreateHsaRequest {
  abha_id: string;
}

// ==================== Contributions ====================

export type ContributionSourceType =
  | 'self'
  | 'employer'
  | 'platform'
  | 'family'
  | 'tip'
  | 'csr'
  | 'community'
  | 'government';

export interface Contribution {
  id: string;
  hsa_id: string;
  source_type: ContributionSourceType;
  source_id?: string;
  amount_paise: number;
  currency: string;
  reference_id?: string;
  idempotency_key?: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface CreateContributionRequest {
  source_type: ContributionSourceType;
  source_id?: string;
  amount_paise: number;
  idempotency_key: string;
  metadata?: Record<string, unknown>;
}

export interface ContributionSummary {
  source_type: ContributionSourceType;
  total_paise: number;
  count: number;
}

// ==================== Partners ====================

export type PartnerType =
  | 'gig_platform'
  | 'household'
  | 'employer'
  | 'csr'
  | 'ngo';

export interface Partner {
  id: string;
  user_id: string;
  partner_type: PartnerType;
  business_name?: string;
  business_reg_number?: string;
  contribution_scheme?: ContributionScheme;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ContributionScheme {
  type: 'per_task' | 'monthly_fixed' | 'custom';
  amount_paise: number;
  description?: string;
}

export interface RegisterPartnerRequest {
  partner_type: PartnerType;
  business_name?: string;
  business_reg_number?: string;
  contribution_scheme?: ContributionScheme;
}

export interface WorkerWithHsa {
  user: User;
  hsa?: HealthSavingsAccount;
  enrolled_at: string;
}

export interface BulkContributionItem {
  worker_user_id: string;
  amount_paise: number;
}

export interface BulkContributionRequest {
  contributions: BulkContributionItem[];
  idempotency_key: string;
}

export interface PartnerDashboard {
  total_workers: number;
  total_contributed_paise: number;
  coverage_rate: number; // 0.0 to 1.0 (% of workers with insurance)
  recent_contributions: Contribution[];
}

// ==================== Insurance ====================

export interface InsurancePlan {
  id: string;
  provider: string;
  plan_name: string;
  premium_paise: number;
  coverage_paise: number;
  description?: string;
  min_balance_paise: number;
  features: string[];
}

export interface InsurancePolicy {
  id: string;
  user_id: string;
  hsa_id: string;
  provider: string;
  plan_name: string;
  premium_paise: number;
  coverage_paise: number;
  status: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscribeRequest {
  plan_id: string;
}

// ==================== Claims ====================

export type ClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'settled';

export interface Claim {
  id: string;
  policy_id: string;
  user_id: string;
  claim_amount_paise: number;
  approved_amount_paise?: number;
  status: ClaimStatus;
  description?: string;
  documents?: ClaimDocument[];
  submitted_at: string;
  resolved_at?: string;
}

export interface ClaimDocument {
  name: string;
  url: string;
  type: string;
}

export interface SubmitClaimRequest {
  policy_id: string;
  claim_amount_paise: number;
  description: string;
  documents?: ClaimDocument[];
}

export interface ReviewClaimRequest {
  status: 'approved' | 'rejected';
  approved_amount_paise?: number;
  reason?: string;
}

// ==================== Health Profile ====================

export interface HealthProfile {
  id: string;
  user_id: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  conditions: string[];
  medications: Medication[];
  allergies: string[];
  emergency_contact?: EmergencyContact;
  created_at: string;
  updated_at: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  reminder_enabled: boolean;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

// ==================== API Common ====================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ApiError {
  error: string;
  message: string;
}

// ==================== Utility ====================

/** Format paise to ₹ string (e.g., 399900 → "₹3,999.00") */
export function formatCurrency(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format paise to compact ₹ string (e.g., 399900 → "₹3,999") */
export function formatCurrencyCompact(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
