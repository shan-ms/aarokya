/**
 * ART: HSA Store Tests
 *
 * Tests the Zustand HSA store for balance management, dashboard fetching,
 * contribution pagination, and error handling.
 */

import { useHsaStore } from '../../store/hsaStore';
import { getDashboard } from '../../api/hsa';
import { listContributions } from '../../api/contributions';
import { Dashboard, Contribution, ContributionSummary, Policy } from '../../types';

jest.mock('../../api/hsa');
jest.mock('../../api/contributions');

const mockedGetDashboard = getDashboard as jest.MockedFunction<typeof getDashboard>;
const mockedListContributions = listContributions as jest.MockedFunction<
  typeof listContributions
>;

const mockContribution: Contribution = {
  id: 'contrib-001',
  hsaId: 'hsa-001',
  amount: 50000, // 500.00 INR
  source: 'self',
  status: 'completed',
  description: 'Monthly saving',
  createdAt: '2025-02-01T10:00:00Z',
};

const mockContributionSummary: ContributionSummary = {
  total: 250000,
  bySelf: 150000,
  byEmployer: 100000,
  byGovernment: 0,
  byCashback: 0,
  byReferral: 0,
  monthlyAverage: 50000,
  streak: 5,
};

const mockPolicy: Policy = {
  id: 'policy-001',
  userId: 'user-001',
  planId: 'plan-001',
  plan: {
    id: 'plan-001',
    name: 'Basic Health',
    type: 'basic',
    premium: 199900,
    coverageAmount: 10000000,
    minHsaBalance: 399900,
    features: ['OPD Coverage'],
    description: 'Basic plan',
    active: true,
  },
  status: 'active',
  startDate: '2025-01-01',
  endDate: '2026-01-01',
  premiumPaid: 199900,
  policyNumber: 'POL-2025-001',
  createdAt: '2025-01-01T00:00:00Z',
};

const mockDashboardData: { data: Dashboard } = {
  data: {
    hsa: {
      id: 'hsa-001',
      userId: 'user-001',
      abhaId: 'ABHA-12345',
      balance: 500000, // 5,000.00 INR
      totalContributed: 750000,
      totalWithdrawn: 250000,
      insuranceEligible: true,
      insuranceThreshold: 399900,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-02-15T00:00:00Z',
    },
    contributionSummary: mockContributionSummary,
    recentContributions: [mockContribution],
    activePolicies: [mockPolicy],
  },
};

describe('hsaStore', () => {
  beforeEach(() => {
    useHsaStore.getState().reset();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with zero balance', () => {
      expect(useHsaStore.getState().balance).toBe(0);
    });

    it('should start with zero totalContributed', () => {
      expect(useHsaStore.getState().totalContributed).toBe(0);
    });

    it('should start with insuranceEligible = false', () => {
      expect(useHsaStore.getState().insuranceEligible).toBe(false);
    });

    it('should start with empty contributions array', () => {
      expect(useHsaStore.getState().contributions).toEqual([]);
    });

    it('should start with loading = false', () => {
      expect(useHsaStore.getState().loading).toBe(false);
    });

    it('should start with error = null', () => {
      expect(useHsaStore.getState().error).toBeNull();
    });
  });

  describe('fetchDashboard', () => {
    it('should set loading true while fetching', async () => {
      let loadingDuringFetch = false;
      mockedGetDashboard.mockImplementation(() => {
        loadingDuringFetch = useHsaStore.getState().loading;
        return Promise.resolve(mockDashboardData as any);
      });

      await useHsaStore.getState().fetchDashboard();
      expect(loadingDuringFetch).toBe(true);
    });

    it('should populate all dashboard fields on success', async () => {
      mockedGetDashboard.mockResolvedValue(mockDashboardData as any);

      await useHsaStore.getState().fetchDashboard();

      const state = useHsaStore.getState();
      expect(state.balance).toBe(500000);
      expect(state.totalContributed).toBe(750000);
      expect(state.insuranceEligible).toBe(true);
      expect(state.insuranceThreshold).toBe(399900);
      expect(state.contributions).toHaveLength(1);
      expect(state.contributions[0].id).toBe('contrib-001');
      expect(state.contributionSummary).toEqual(mockContributionSummary);
      expect(state.activePolicies).toHaveLength(1);
    });

    it('should set loading false after success', async () => {
      mockedGetDashboard.mockResolvedValue(mockDashboardData as any);

      await useHsaStore.getState().fetchDashboard();

      expect(useHsaStore.getState().loading).toBe(false);
    });

    it('should clear previous error on new fetch', async () => {
      // First: simulate an error
      mockedGetDashboard.mockRejectedValueOnce(new Error('Network error'));
      await useHsaStore.getState().fetchDashboard();
      expect(useHsaStore.getState().error).toBe('Network error');

      // Second: successful fetch should clear the error
      mockedGetDashboard.mockResolvedValue(mockDashboardData as any);
      await useHsaStore.getState().fetchDashboard();
      expect(useHsaStore.getState().error).toBeNull();
    });

    it('should set error message on API failure', async () => {
      mockedGetDashboard.mockRejectedValue(new Error('Server unavailable'));

      await useHsaStore.getState().fetchDashboard();

      const state = useHsaStore.getState();
      expect(state.error).toBe('Server unavailable');
      expect(state.loading).toBe(false);
    });

    it('should use fallback error message when error has no message', async () => {
      mockedGetDashboard.mockRejectedValue({});

      await useHsaStore.getState().fetchDashboard();

      expect(useHsaStore.getState().error).toBe('Failed to fetch dashboard');
    });
  });

  describe('fetchContributions', () => {
    const mockPaginatedContributions = {
      data: [mockContribution],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    };

    it('should replace contributions on page 1', async () => {
      // Pre-populate with existing contributions
      useHsaStore.setState({
        contributions: [{ ...mockContribution, id: 'old-contrib' }],
      });

      mockedListContributions.mockResolvedValue(mockPaginatedContributions as any);

      await useHsaStore.getState().fetchContributions(1);

      const contributions = useHsaStore.getState().contributions;
      expect(contributions).toHaveLength(1);
      expect(contributions[0].id).toBe('contrib-001');
    });

    it('should append contributions on page > 1 (pagination)', async () => {
      useHsaStore.setState({
        contributions: [{ ...mockContribution, id: 'page1-contrib' }],
      });

      const page2Contribution = { ...mockContribution, id: 'page2-contrib' };
      mockedListContributions.mockResolvedValue({
        data: [page2Contribution],
        total: 2,
        page: 2,
        pageSize: 20,
        hasMore: false,
      } as any);

      await useHsaStore.getState().fetchContributions(2);

      const contributions = useHsaStore.getState().contributions;
      expect(contributions).toHaveLength(2);
      expect(contributions[0].id).toBe('page1-contrib');
      expect(contributions[1].id).toBe('page2-contrib');
    });

    it('should default to page 1 when no page argument provided', async () => {
      mockedListContributions.mockResolvedValue(mockPaginatedContributions as any);

      await useHsaStore.getState().fetchContributions();

      expect(mockedListContributions).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    });

    it('should set loading false after fetching contributions', async () => {
      mockedListContributions.mockResolvedValue(mockPaginatedContributions as any);

      await useHsaStore.getState().fetchContributions();

      expect(useHsaStore.getState().loading).toBe(false);
    });

    it('should set error on failure', async () => {
      mockedListContributions.mockRejectedValue(new Error('Timeout'));

      await useHsaStore.getState().fetchContributions();

      expect(useHsaStore.getState().error).toBe('Timeout');
      expect(useHsaStore.getState().loading).toBe(false);
    });

    it('should use fallback error message when error has no message', async () => {
      mockedListContributions.mockRejectedValue({});

      await useHsaStore.getState().fetchContributions();

      expect(useHsaStore.getState().error).toBe('Failed to fetch contributions');
    });
  });

  describe('reset', () => {
    it('should restore all fields to initial state', async () => {
      // Populate with data
      mockedGetDashboard.mockResolvedValue(mockDashboardData as any);
      await useHsaStore.getState().fetchDashboard();

      // Verify populated
      expect(useHsaStore.getState().balance).toBe(500000);

      // Reset
      useHsaStore.getState().reset();

      const state = useHsaStore.getState();
      expect(state.balance).toBe(0);
      expect(state.totalContributed).toBe(0);
      expect(state.insuranceEligible).toBe(false);
      expect(state.contributions).toEqual([]);
      expect(state.contributionSummary).toBeNull();
      expect(state.activePolicies).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
