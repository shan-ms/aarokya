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

// Consent (DPDP compliance)
export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string;
  scope?: string;
  grantedAt: string;
  withdrawnAt?: string;
}

// Family profiles
export interface FamilyMember {
  id: string;
  caregiverUserId: string;
  memberName: string;
  relationship: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: string;
  status: string;
  createdAt: string;
}

// Health documents
export interface HealthDocument {
  id: string;
  userId: string;
  familyMemberId?: string;
  documentType: string;
  title: string;
  description?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  tags?: string[];
  createdAt: string;
}

// Check-in / Triage
export interface Symptom {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  duration?: string;
}

export type UrgencyLevel = 'self_care' | 'schedule_visit' | 'urgent' | 'emergency';

export interface TriageResult {
  urgencyLevel: UrgencyLevel;
  recommendation: string;
  suggestedActions: string[];
  emergency: boolean;
}

export interface CheckinRecord {
  id: string;
  userId: string;
  familyMemberId?: string;
  symptoms: Symptom[];
  urgencyLevel: UrgencyLevel;
  recommendation: string;
  createdAt: string;
}

export interface RecordShare {
  id: string;
  documentId?: string;
  sharedWith: string;
  purpose?: string;
  sharedAt: string;
  expiresAt?: string;
  revokedAt?: string;
}

// Data export (DPDP)
export interface DataExport {
  user: User;
  healthProfile?: HealthProfile;
  hsa?: HSA;
  contributions: Contribution[];
  documents: HealthDocument[];
  consents: ConsentRecord[];
  familyMembers: FamilyMember[];
  sharingHistory: RecordShare[];
}
