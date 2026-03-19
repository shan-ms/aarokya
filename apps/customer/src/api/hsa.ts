import client from './client';
import { ApiResponse, HSA, Dashboard } from '../types';

/** Backend HsaDashboard response (snake_case) */
interface BackendHsaDashboard {
  balance_paise: number;
  total_contributed_paise: number;
  insurance_eligible: boolean;
  basic_insurance_progress: number;
  premium_insurance_progress: number;
  contribution_count: number;
  contribution_velocity_paise_per_month: number;
  insurance_tier: string;
}

const BASIC_INSURANCE_THRESHOLD = 399900; // paise

export const getHsa = async (): Promise<ApiResponse<HSA>> => {
  const response = await client.get<HSA>('/hsa');
  return { data: response.data };
};

export const getDashboard = async (): Promise<ApiResponse<Dashboard>> => {
  const response = await client.get<BackendHsaDashboard>('/hsa/dashboard');
  const data = response.data;
  const dashboard: Dashboard = {
    hsa: {
      id: '',
      userId: '',
      abhaId: '',
      balance: data.balance_paise,
      totalContributed: data.total_contributed_paise,
      totalWithdrawn: 0,
      insuranceEligible: data.insurance_eligible,
      insuranceThreshold: BASIC_INSURANCE_THRESHOLD,
      createdAt: '',
      updatedAt: '',
    },
    contributionSummary: {
      total: data.total_contributed_paise,
      bySelf: 0,
      byEmployer: 0,
      byGovernment: 0,
      byCashback: 0,
      byReferral: 0,
      monthlyAverage: data.contribution_velocity_paise_per_month,
      streak: 0,
    },
    recentContributions: [],
    activePolicies: [],
  };
  return { data: dashboard };
};

export const createHsa = async (abhaId: string): Promise<ApiResponse<HSA>> => {
  const response = await client.post<ApiResponse<HSA>>('/hsa', { abha_id: abhaId });
  return response.data;
};
