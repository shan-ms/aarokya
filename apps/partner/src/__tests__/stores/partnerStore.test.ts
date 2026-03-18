/**
 * ART: Partner Store Tests
 *
 * Tests the Zustand partner store for workers list, dashboard metrics,
 * contributions, pagination, and error handling.
 */

import { usePartnerStore } from '../../store/partnerStore';
import { listWorkers } from '../../api/workers';
import { getDashboard } from '../../api/partner';
import { getContributionHistory } from '../../api/contributions';
import {
  WorkerWithHsa,
  PartnerDashboard,
  Contribution,
  PaginatedResponse,
} from '../../types';

jest.mock('../../api/workers');
jest.mock('../../api/partner');
jest.mock('../../api/contributions');

const mockedListWorkers = listWorkers as jest.MockedFunction<typeof listWorkers>;
const mockedGetDashboard = getDashboard as jest.MockedFunction<typeof getDashboard>;
const mockedGetContributions = getContributionHistory as jest.MockedFunction<
  typeof getContributionHistory
>;

const PARTNER_ID = 'partner-001';

const mockWorker = (id: string, name: string): WorkerWithHsa => ({
  id,
  name,
  phone: `+91900000000${id.slice(-1)}`,
  hsaBalancePaise: 500000,
  insuranceStatus: 'active',
  totalContributionsFromPartnerPaise: 250000,
  createdAt: '2025-06-01T00:00:00Z',
  lastContributionAt: '2025-12-01T00:00:00Z',
});

const mockContribution = (id: string): Contribution => ({
  id,
  workerId: 'worker-001',
  workerName: 'Ramesh Kumar',
  partnerId: PARTNER_ID,
  amountPaise: 50000,
  sourceType: 'employer',
  status: 'completed',
  createdAt: '2025-12-15T10:00:00Z',
});

const mockDashboard: PartnerDashboard = {
  totalWorkers: 150,
  totalContributedPaise: 7500000,
  coverageRate: 72,
  recentContributions: [mockContribution('c-1'), mockContribution('c-2')],
  monthlyTrendPaise: [500000, 600000, 700000],
};

describe('partnerStore', () => {
  beforeEach(() => {
    usePartnerStore.getState().reset();
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty workers, null dashboard, empty contributions', () => {
      const state = usePartnerStore.getState();
      expect(state.workers).toEqual([]);
      expect(state.workersTotal).toBe(0);
      expect(state.workersPage).toBe(1);
      expect(state.workersHasMore).toBe(false);
      expect(state.workersLoading).toBe(false);
      expect(state.workersError).toBeNull();
      expect(state.dashboard).toBeNull();
      expect(state.dashboardLoading).toBe(false);
      expect(state.dashboardError).toBeNull();
      expect(state.contributions).toEqual([]);
      expect(state.contributionsTotal).toBe(0);
      expect(state.contributionsLoading).toBe(false);
      expect(state.contributionsError).toBeNull();
    });
  });

  describe('fetchWorkers', () => {
    const workersPage1: PaginatedResponse<WorkerWithHsa> = {
      items: [mockWorker('w-1', 'Ramesh'), mockWorker('w-2', 'Suresh')],
      total: 5,
      page: 1,
      pageSize: 20,
      hasMore: true,
    };

    it('should fetch and set workers on success', async () => {
      mockedListWorkers.mockResolvedValue({ data: workersPage1 } as any);

      await usePartnerStore.getState().fetchWorkers(PARTNER_ID);

      const state = usePartnerStore.getState();
      expect(state.workers).toHaveLength(2);
      expect(state.workers[0].name).toBe('Ramesh');
      expect(state.workersTotal).toBe(5);
      expect(state.workersPage).toBe(1);
      expect(state.workersHasMore).toBe(true);
      expect(state.workersLoading).toBe(false);
      expect(state.workersError).toBeNull();
    });

    it('should pass search parameter to API', async () => {
      mockedListWorkers.mockResolvedValue({ data: workersPage1 } as any);

      await usePartnerStore.getState().fetchWorkers(PARTNER_ID, { search: 'Ramesh' });

      expect(mockedListWorkers).toHaveBeenCalledWith(PARTNER_ID, {
        page: 1,
        pageSize: 20,
        search: 'Ramesh',
      });
    });

    it('should pass page parameter to API', async () => {
      mockedListWorkers.mockResolvedValue({ data: workersPage1 } as any);

      await usePartnerStore.getState().fetchWorkers(PARTNER_ID, { page: 3 });

      expect(mockedListWorkers).toHaveBeenCalledWith(PARTNER_ID, {
        page: 3,
        pageSize: 20,
        search: undefined,
      });
    });

    it('should set workersError on API failure', async () => {
      mockedListWorkers.mockRejectedValue(new Error('Network error'));

      await usePartnerStore.getState().fetchWorkers(PARTNER_ID);

      const state = usePartnerStore.getState();
      expect(state.workersError).toBe('Network error');
      expect(state.workersLoading).toBe(false);
      expect(state.workers).toEqual([]);
    });

    it('should use fallback error message for non-Error exceptions', async () => {
      mockedListWorkers.mockRejectedValue('something broke');

      await usePartnerStore.getState().fetchWorkers(PARTNER_ID);

      expect(usePartnerStore.getState().workersError).toBe('Failed to fetch workers');
    });

    it('should set workersLoading to true during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockedListWorkers.mockReturnValue(pendingPromise as any);

      const fetchPromise = usePartnerStore.getState().fetchWorkers(PARTNER_ID);

      expect(usePartnerStore.getState().workersLoading).toBe(true);
      expect(usePartnerStore.getState().workersError).toBeNull();

      resolvePromise!({ data: workersPage1 });
      await fetchPromise;

      expect(usePartnerStore.getState().workersLoading).toBe(false);
    });
  });

  describe('fetchMoreWorkers', () => {
    it('should append workers when loading more pages', async () => {
      // Set initial state with page 1 loaded
      usePartnerStore.setState({
        workers: [mockWorker('w-1', 'Ramesh')],
        workersPage: 1,
        workersHasMore: true,
        workersLoading: false,
      });

      const page2: PaginatedResponse<WorkerWithHsa> = {
        items: [mockWorker('w-2', 'Suresh')],
        total: 2,
        page: 2,
        pageSize: 20,
        hasMore: false,
      };
      mockedListWorkers.mockResolvedValue({ data: page2 } as any);

      await usePartnerStore.getState().fetchMoreWorkers(PARTNER_ID);

      const state = usePartnerStore.getState();
      expect(state.workers).toHaveLength(2);
      expect(state.workers[0].name).toBe('Ramesh');
      expect(state.workers[1].name).toBe('Suresh');
      expect(state.workersPage).toBe(2);
      expect(state.workersHasMore).toBe(false);
    });

    it('should request page + 1', async () => {
      usePartnerStore.setState({
        workers: [mockWorker('w-1', 'Ramesh')],
        workersPage: 3,
        workersHasMore: true,
        workersLoading: false,
      });

      const page4: PaginatedResponse<WorkerWithHsa> = {
        items: [],
        total: 3,
        page: 4,
        pageSize: 20,
        hasMore: false,
      };
      mockedListWorkers.mockResolvedValue({ data: page4 } as any);

      await usePartnerStore.getState().fetchMoreWorkers(PARTNER_ID);

      expect(mockedListWorkers).toHaveBeenCalledWith(PARTNER_ID, {
        page: 4,
        pageSize: 20,
      });
    });

    it('should not fetch when hasMore is false', async () => {
      usePartnerStore.setState({
        workers: [mockWorker('w-1', 'Ramesh')],
        workersHasMore: false,
        workersLoading: false,
      });

      await usePartnerStore.getState().fetchMoreWorkers(PARTNER_ID);

      expect(mockedListWorkers).not.toHaveBeenCalled();
    });

    it('should not fetch when already loading', async () => {
      usePartnerStore.setState({
        workers: [mockWorker('w-1', 'Ramesh')],
        workersHasMore: true,
        workersLoading: true,
      });

      await usePartnerStore.getState().fetchMoreWorkers(PARTNER_ID);

      expect(mockedListWorkers).not.toHaveBeenCalled();
    });

    it('should set error on failure during fetchMore', async () => {
      usePartnerStore.setState({
        workers: [mockWorker('w-1', 'Ramesh')],
        workersPage: 1,
        workersHasMore: true,
        workersLoading: false,
      });

      mockedListWorkers.mockRejectedValue(new Error('Timeout'));

      await usePartnerStore.getState().fetchMoreWorkers(PARTNER_ID);

      expect(usePartnerStore.getState().workersError).toBe('Timeout');
      expect(usePartnerStore.getState().workersLoading).toBe(false);
    });
  });

  describe('fetchDashboard', () => {
    it('should fetch and set dashboard data', async () => {
      mockedGetDashboard.mockResolvedValue({ data: mockDashboard } as any);

      await usePartnerStore.getState().fetchDashboard(PARTNER_ID);

      const state = usePartnerStore.getState();
      expect(state.dashboard).toEqual(mockDashboard);
      expect(state.dashboardLoading).toBe(false);
      expect(state.dashboardError).toBeNull();
    });

    it('should verify dashboard contains correct paise values', async () => {
      mockedGetDashboard.mockResolvedValue({ data: mockDashboard } as any);

      await usePartnerStore.getState().fetchDashboard(PARTNER_ID);

      const dash = usePartnerStore.getState().dashboard!;
      // 7500000 paise = ₹75,000
      expect(dash.totalContributedPaise).toBe(7500000);
      expect(dash.totalContributedPaise / 100).toBe(75000);
      expect(dash.totalWorkers).toBe(150);
      expect(dash.coverageRate).toBe(72);
    });

    it('should set dashboardError on failure', async () => {
      mockedGetDashboard.mockRejectedValue(new Error('Server error'));

      await usePartnerStore.getState().fetchDashboard(PARTNER_ID);

      const state = usePartnerStore.getState();
      expect(state.dashboardError).toBe('Server error');
      expect(state.dashboardLoading).toBe(false);
      expect(state.dashboard).toBeNull();
    });

    it('should use fallback error message for non-Error exceptions', async () => {
      mockedGetDashboard.mockRejectedValue(42);

      await usePartnerStore.getState().fetchDashboard(PARTNER_ID);

      expect(usePartnerStore.getState().dashboardError).toBe('Failed to fetch dashboard');
    });
  });

  describe('fetchContributions', () => {
    const contributionPage: PaginatedResponse<Contribution> = {
      items: [mockContribution('c-1'), mockContribution('c-2')],
      total: 50,
      page: 1,
      pageSize: 20,
      hasMore: true,
    };

    it('should fetch and set contributions', async () => {
      mockedGetContributions.mockResolvedValue({ data: contributionPage } as any);

      await usePartnerStore.getState().fetchContributions(PARTNER_ID);

      const state = usePartnerStore.getState();
      expect(state.contributions).toHaveLength(2);
      expect(state.contributionsTotal).toBe(50);
      expect(state.contributionsLoading).toBe(false);
      expect(state.contributionsError).toBeNull();
    });

    it('should pass filter parameters to API', async () => {
      mockedGetContributions.mockResolvedValue({ data: contributionPage } as any);

      await usePartnerStore.getState().fetchContributions(PARTNER_ID, {
        page: 2,
        workerId: 'worker-001',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      expect(mockedGetContributions).toHaveBeenCalledWith(PARTNER_ID, {
        page: 2,
        pageSize: 20,
        workerId: 'worker-001',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });
    });

    it('should set contributionsError on failure', async () => {
      mockedGetContributions.mockRejectedValue(new Error('Fetch failed'));

      await usePartnerStore.getState().fetchContributions(PARTNER_ID);

      const state = usePartnerStore.getState();
      expect(state.contributionsError).toBe('Fetch failed');
      expect(state.contributionsLoading).toBe(false);
    });

    it('should verify contribution amounts are in paise', async () => {
      mockedGetContributions.mockResolvedValue({ data: contributionPage } as any);

      await usePartnerStore.getState().fetchContributions(PARTNER_ID);

      const contributions = usePartnerStore.getState().contributions;
      contributions.forEach((c) => {
        expect(c.amountPaise).toBe(50000); // 50000 paise = ₹500
        expect(c.amountPaise / 100).toBe(500);
      });
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      // Populate state
      mockedGetDashboard.mockResolvedValue({ data: mockDashboard } as any);
      mockedListWorkers.mockResolvedValue({
        data: {
          items: [mockWorker('w-1', 'Ramesh')],
          total: 1,
          page: 1,
          pageSize: 20,
          hasMore: false,
        },
      } as any);

      await usePartnerStore.getState().fetchDashboard(PARTNER_ID);
      await usePartnerStore.getState().fetchWorkers(PARTNER_ID);

      expect(usePartnerStore.getState().dashboard).not.toBeNull();
      expect(usePartnerStore.getState().workers).toHaveLength(1);

      // Reset
      usePartnerStore.getState().reset();

      const state = usePartnerStore.getState();
      expect(state.workers).toEqual([]);
      expect(state.workersTotal).toBe(0);
      expect(state.dashboard).toBeNull();
      expect(state.contributions).toEqual([]);
    });
  });
});
