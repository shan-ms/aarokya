export type PartnerType =
  | 'gig_platform'
  | 'household_employer'
  | 'corporate_employer'
  | 'csr_program'
  | 'ngo';

export type ContributionSchemeType = 'per_task' | 'monthly_fixed';

export type ContributionSourceType = 'employer' | 'platform_fee' | 'csr' | 'grant';

export type InsuranceStatus = 'active' | 'pending' | 'expired' | 'none';

export interface Partner {
  id: string;
  phone: string;
  businessName: string;
  registrationNumber: string;
  partnerType: PartnerType;
  contributionScheme: ContributionScheme;
  totalWorkers: number;
  totalContributedPaise: number;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  abhaId?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface WorkerWithHsa extends Worker {
  hsaBalancePaise: number;
  insuranceStatus: InsuranceStatus;
  insuranceExpiresAt?: string;
  totalContributionsFromPartnerPaise: number;
  lastContributionAt?: string;
}

export interface ContributionScheme {
  type: ContributionSchemeType;
  amountPaise: number;
  description?: string;
}

export interface Contribution {
  id: string;
  workerId: string;
  workerName: string;
  partnerId: string;
  amountPaise: number;
  sourceType: ContributionSourceType;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface BulkContribution {
  id: string;
  partnerId: string;
  workerIds: string[];
  amountPerWorkerPaise: number;
  totalAmountPaise: number;
  sourceType: ContributionSourceType;
  status: 'pending' | 'processing' | 'completed' | 'partial_failure';
  successCount: number;
  failureCount: number;
  createdAt: string;
}

export interface PartnerDashboard {
  totalWorkers: number;
  totalContributedPaise: number;
  coverageRate: number;
  recentContributions: Contribution[];
  monthlyTrendPaise: number[];
}

export interface Report {
  id: string;
  partnerId: string;
  startDate: string;
  endDate: string;
  totalAmountPaise: number;
  workerCount: number;
  contributionCount: number;
  downloadUrl?: string;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
