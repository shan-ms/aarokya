export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  abhaId?: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface HSA {
  id: string;
  userId: string;
  abhaId: string;
  /** Balance in paise */
  balance: number;
  /** Total contributed in paise */
  totalContributed: number;
  /** Total withdrawn in paise */
  totalWithdrawn: number;
  insuranceEligible: boolean;
  /** Threshold in paise required for insurance eligibility */
  insuranceThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export type ContributionSource =
  | 'self'
  | 'employer'
  | 'government'
  | 'platform_cashback'
  | 'referral';

export type ContributionStatus = 'pending' | 'completed' | 'failed';

export interface Contribution {
  id: string;
  hsaId: string;
  /** Amount in paise */
  amount: number;
  source: ContributionSource;
  status: ContributionStatus;
  referenceId?: string;
  description?: string;
  createdAt: string;
}

export interface ContributionSummary {
  /** Total in paise */
  total: number;
  bySelf: number;
  byEmployer: number;
  byGovernment: number;
  byCashback: number;
  byReferral: number;
  monthlyAverage: number;
  streak: number;
}

export type PlanType = 'basic' | 'standard' | 'premium';

export interface InsurancePlan {
  id: string;
  name: string;
  type: PlanType;
  /** Premium in paise */
  premium: number;
  /** Coverage amount in paise */
  coverageAmount: number;
  /** Minimum HSA balance in paise to be eligible */
  minHsaBalance: number;
  features: string[];
  description: string;
  active: boolean;
}

export type PolicyStatus = 'active' | 'expired' | 'cancelled' | 'pending';

export interface Policy {
  id: string;
  userId: string;
  planId: string;
  plan: InsurancePlan;
  status: PolicyStatus;
  startDate: string;
  endDate: string;
  /** Premium in paise */
  premiumPaid: number;
  policyNumber: string;
  createdAt: string;
}

export type ClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'paid';

export interface Claim {
  id: string;
  policyId: string;
  /** Amount in paise */
  amount: number;
  status: ClaimStatus;
  description: string;
  hospitalName?: string;
  diagnosisCode?: string;
  documents: string[];
  submittedAt: string;
  resolvedAt?: string;
}

export type Gender = 'male' | 'female' | 'other';
export type BloodGroup =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | 'O+'
  | 'O-';

export interface HealthProfile {
  id: string;
  userId: string;
  dateOfBirth?: string;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  height?: number;
  weight?: number;
  conditions: string[];
  medications: string[];
  allergies: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  updatedAt: string;
}

export interface Dashboard {
  hsa: HSA;
  contributionSummary: ContributionSummary;
  recentContributions: Contribution[];
  activePolicies: Policy[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
