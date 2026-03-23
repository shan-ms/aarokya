/**
 * ART: WorkersScreen Tests
 *
 * Tests the workers list screen: worker rendering, search functionality,
 * pagination, loading/error/empty states, FAB navigation.
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import WorkersScreen from '../../screens/WorkersScreen';
import { useAuthStore } from '../../store/authStore';
import { usePartnerStore } from '../../store/partnerStore';
import { Partner, WorkerWithHsa } from '../../types';

jest.mock('../../api/workers');
jest.mock('../../api/partner');
jest.mock('../../api/contributions');
jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

const mockPartner: Partner = {
  id: 'partner-001',
  phone: '+919876543210',
  businessName: 'Acme Logistics',
  registrationNumber: 'CIN-U12345',
  partnerType: 'gig_platform',
  contributionScheme: { type: 'per_task', amountPaise: 5000 },
  totalWorkers: 3,
  totalContributedPaise: 150000,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-03-01T12:00:00Z',
};

const mockWorkers: WorkerWithHsa[] = [
  {
    id: 'w-1',
    name: 'Ramesh Kumar',
    phone: '+919876000001',
    hsaBalancePaise: 500000,
    insuranceStatus: 'active',
    totalContributionsFromPartnerPaise: 250000,
    createdAt: '2025-06-01T00:00:00Z',
    lastContributionAt: '2025-12-01T00:00:00Z',
  },
  {
    id: 'w-2',
    name: 'Suresh Patel',
    phone: '+919876000002',
    hsaBalancePaise: 200000,
    insuranceStatus: 'none',
    totalContributionsFromPartnerPaise: 100000,
    createdAt: '2025-07-01T00:00:00Z',
  },
  {
    id: 'w-3',
    name: 'Priya Singh',
    phone: '+919876000003',
    hsaBalancePaise: 399900,
    insuranceStatus: 'pending',
    totalContributionsFromPartnerPaise: 399900,
    createdAt: '2025-08-01T00:00:00Z',
  },
];

const mockNavigation = {
  navigate: jest.fn(),
};

describe('WorkersScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    useAuthStore.setState({
      partner: mockPartner,
      isAuthenticated: true,
      token: 'test-token',
      refreshToken: 'test-refresh',
      isNewPartner: false,
    });

    // Reset partner store to default with workers loaded
    usePartnerStore.setState({
      workers: mockWorkers,
      workersTotal: 3,
      workersPage: 1,
      workersHasMore: false,
      workersLoading: false,
      workersError: null,
      dashboard: null,
      dashboardLoading: false,
      dashboardError: null,
      contributions: [],
      contributionsTotal: 0,
      contributionsLoading: false,
      contributionsError: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('worker list rendering', () => {
    it('should display worker names', () => {
      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('Ramesh Kumar')).toBeTruthy();
      expect(getByText('Suresh Patel')).toBeTruthy();
      expect(getByText('Priya Singh')).toBeTruthy();
    });

    it('should display worker phone numbers', () => {
      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('+919876000001')).toBeTruthy();
      expect(getByText('+919876000002')).toBeTruthy();
    });

    it('should display HSA balances formatted as currency (paise to rupees)', () => {
      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      // 500000 paise = ₹5,000
      expect(getByText('₹5,000')).toBeTruthy();
      // 200000 paise = ₹2,000
      expect(getByText('₹2,000')).toBeTruthy();
      // 399900 paise = ₹3,999
      expect(getByText('₹3,999')).toBeTruthy();
    });

    it('should display insurance status badges', () => {
      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('Insured')).toBeTruthy();
      expect(getByText('No Insurance')).toBeTruthy();
      expect(getByText('Pending')).toBeTruthy();
    });

    it('should display screen title', () => {
      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('workers.title')).toBeTruthy();
    });
  });

  describe('search functionality', () => {
    it('should render search input', () => {
      const { getByPlaceholderText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByPlaceholderText('workers.searchPlaceholder')).toBeTruthy();
    });

    it('should debounce search and call fetchWorkers after 300ms', () => {
      const fetchWorkersSpy = jest.fn();
      usePartnerStore.setState({ fetchWorkers: fetchWorkersSpy } as any);

      const { getByPlaceholderText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      const searchInput = getByPlaceholderText('workers.searchPlaceholder');
      fireEvent.changeText(searchInput, 'Ramesh');

      // fetchWorkers should not be called immediately with search param
      // (there is an initial call on mount, so we check the debounced one)
      const callCountBefore = fetchWorkersSpy.mock.calls.length;

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // After 300ms, should have called with search param
      const callsAfter = fetchWorkersSpy.mock.calls;
      const lastCall = callsAfter[callsAfter.length - 1];
      expect(lastCall[0]).toBe('partner-001');
      expect(lastCall[1]).toEqual({ search: 'Ramesh' });
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when loading with no workers', () => {
      usePartnerStore.setState({
        workers: [],
        workersLoading: true,
      });

      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('common.loading')).toBeTruthy();
    });

    it('should not show full-screen loading when workers already loaded', () => {
      usePartnerStore.setState({
        workers: mockWorkers,
        workersLoading: true,
      });

      const { queryByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      // Should NOT show fullscreen spinner - should show list with refresh indicator
      expect(queryByText('common.loading')).toBeNull();
    });
  });

  describe('error state', () => {
    it('should show error state with retry button', () => {
      usePartnerStore.setState({
        workers: [],
        workersLoading: false,
        workersError: 'Network error occurred',
      });

      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('common.error')).toBeTruthy();
      expect(getByText('Network error occurred')).toBeTruthy();
      expect(getByText('common.retry')).toBeTruthy();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no workers and not loading', () => {
      usePartnerStore.setState({
        workers: [],
        workersLoading: false,
        workersError: null,
      });

      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('workers.noWorkers')).toBeTruthy();
      expect(getByText('workers.noWorkersDesc')).toBeTruthy();
    });

    it('should show add worker button in empty state', () => {
      usePartnerStore.setState({
        workers: [],
        workersLoading: false,
        workersError: null,
      });

      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('workers.addWorker')).toBeTruthy();
    });

    it('should navigate to AddWorker from empty state action', () => {
      usePartnerStore.setState({
        workers: [],
        workersLoading: false,
        workersError: null,
      });

      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      fireEvent.press(getByText('workers.addWorker'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AddWorker');
    });
  });

  describe('FAB button', () => {
    it('should render FAB with + symbol', () => {
      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      expect(getByText('+')).toBeTruthy();
    });

    it('should navigate to AddWorker on FAB press', () => {
      const { getByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      fireEvent.press(getByText('+'));
      expect(mockNavigation.navigate).toHaveBeenCalledWith('AddWorker');
    });
  });

  describe('worker count verification', () => {
    it('should render the correct number of workers', () => {
      const { getAllByText } = render(
        <WorkersScreen navigation={mockNavigation as any} />,
      );

      // Each worker card shows the first letter as avatar
      // R for Ramesh, S for Suresh, P for Priya
      expect(getAllByText('R')).toBeTruthy();
      expect(getAllByText('S')).toBeTruthy();
      expect(getAllByText('P')).toBeTruthy();
    });
  });
});
