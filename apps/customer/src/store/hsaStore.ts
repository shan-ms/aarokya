import { create } from 'zustand';
import { Contribution, ContributionSummary, Policy } from '../types';
import { getDashboard } from '../api/hsa';
import { listContributions } from '../api/contributions';

interface HsaState {
  /** Balance in paise */
  balance: number;
  /** Total contributed in paise */
  totalContributed: number;
  insuranceEligible: boolean;
  /** Insurance threshold in paise */
  insuranceThreshold: number;
  contributions: Contribution[];
  contributionSummary: ContributionSummary | null;
  activePolicies: Policy[];
  loading: boolean;
  error: string | null;

  fetchDashboard: () => Promise<void>;
  fetchContributions: (page?: number) => Promise<void>;
  reset: () => void;
}

const initialState = {
  balance: 0,
  totalContributed: 0,
  insuranceEligible: false,
  insuranceThreshold: 0,
  contributions: [] as Contribution[],
  contributionSummary: null as ContributionSummary | null,
  activePolicies: [] as Policy[],
  loading: false,
  error: null as string | null,
};

export const useHsaStore = create<HsaState>((set) => ({
  ...initialState,

  fetchDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const response = await getDashboard();
      const { hsa, contributionSummary, recentContributions, activePolicies } =
        response.data;
      set({
        balance: hsa.balance,
        totalContributed: hsa.totalContributed,
        insuranceEligible: hsa.insuranceEligible,
        insuranceThreshold: hsa.insuranceThreshold,
        contributionSummary,
        contributions: recentContributions,
        activePolicies,
        loading: false,
      });
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || 'Failed to fetch dashboard',
      });
    }
  },

  fetchContributions: async (page = 1) => {
    set({ loading: true, error: null });
    try {
      const response = await listContributions({ page, pageSize: 20 });
      set((state) => ({
        contributions:
          page === 1
            ? response.data
            : [...state.contributions, ...response.data],
        loading: false,
      }));
    } catch (error: any) {
      set({
        loading: false,
        error: error?.message || 'Failed to fetch contributions',
      });
    }
  },

  reset: () => set(initialState),
}));
