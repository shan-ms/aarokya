/**
 * ART: DashboardScreen Tests
 *
 * Tests the main dashboard screen: metric cards, coverage bar,
 * recent activity, loading/error/empty states, currency formatting.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardScreen from '../../screens/DashboardScreen';
import { useAuthStore } from '../../store/authStore';
import { getDashboard } from '../../api/partner';
import { Partner, PartnerDashboard } from '../../types';

jest.mock('../../api/partner');
jest.mock('../../api/client', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

const mockedGetDashboard = getDashboard as jest.MockedFunction<typeof getDashboard>;

const mockPartner: Partner = {
  id: 'partner-001',
  phone: '+919876543210',
  businessName: 'Acme Logistics',
  registrationNumber: 'CIN-U12345',
  partnerType: 'gig_platform',
  contributionScheme: { type: 'per_task', amountPaise: 5000 },
  totalWorkers: 150,
  totalContributedPaise: 7500000,
  createdAt: '2025-01-15T10:00:00Z',
  updatedAt: '2025-03-01T12:00:00Z',
};

const mockDashboard: PartnerDashboard = {
  totalWorkers: 150,
  totalContributedPaise: 7500000,
  coverageRate: 72,
  recentContributions: [
    {
      id: 'c-1',
      workerId: 'w-1',
      workerName: 'Ramesh Kumar',
      partnerId: 'partner-001',
      amountPaise: 50000,
      sourceType: 'employer',
      status: 'completed',
      createdAt: '2025-12-15T10:00:00Z',
    },
    {
      id: 'c-2',
      workerId: 'w-2',
      workerName: 'Suresh Patel',
      partnerId: 'partner-001',
      amountPaise: 25000,
      sourceType: 'platform_fee',
      status: 'pending',
      createdAt: '2025-12-14T08:00:00Z',
    },
  ],
  monthlyTrendPaise: [500000, 600000, 700000],
};

const mockNavigation = {
  navigate: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      partner: mockPartner,
      isAuthenticated: true,
      token: 'test-token',
      refreshToken: 'test-refresh',
      isNewPartner: false,
    });
  });

  describe('loading state', () => {
    it('should show loading spinner while fetching dashboard', () => {
      mockedGetDashboard.mockReturnValue(new Promise(() => {})); // never resolves

      const { getByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(getByText('common.loading')).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('should show error state when dashboard fetch fails', async () => {
      mockedGetDashboard.mockRejectedValue(new Error('Server error'));

      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('common.error')).toBeTruthy();
      expect(await findByText('Server error')).toBeTruthy();
    });

    it('should show retry button on error', async () => {
      mockedGetDashboard.mockRejectedValue(new Error('Server error'));

      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('common.retry')).toBeTruthy();
    });
  });

  describe('happy path - dashboard with data', () => {
    beforeEach(() => {
      mockedGetDashboard.mockResolvedValue({
        success: true,
        data: mockDashboard,
      } as any);
    });

    it('should display partner business name in greeting', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      const greeting = await findByText(/Acme Logistics/);
      expect(greeting).toBeTruthy();
    });

    it('should display total workers count', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      // Dashboard shows totalWorkers as string "150"
      expect(await findByText('150')).toBeTruthy();
    });

    it('should format total contributed paise as currency', async () => {
      // 7500000 paise = ₹75,000 = ₹75.0K
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('₹75.0K')).toBeTruthy();
    });

    it('should display coverage rate percentage', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('72%')).toBeTruthy();
    });

    it('should display coverage hint based on rate', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      // 72% is >= 50 but < 75, so "Good progress"
      expect(await findByText('Good progress')).toBeTruthy();
    });

    it('should display recent contribution worker names', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('Ramesh Kumar')).toBeTruthy();
      expect(await findByText('Suresh Patel')).toBeTruthy();
    });

    it('should format recent contribution amounts (paise to rupees)', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      // 50000 paise = ₹500, 25000 paise = ₹250
      expect(await findByText('₹500')).toBeTruthy();
      expect(await findByText('₹250')).toBeTruthy();
    });

    it('should show action buttons for add worker and contribute', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('dashboard.addWorker')).toBeTruthy();
      expect(await findByText('dashboard.contribute')).toBeTruthy();
    });

    it('should navigate to AddWorker on add worker button press', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      const addBtn = await findByText('dashboard.addWorker');
      fireEvent.press(addBtn);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('AddWorker');
    });

    it('should navigate to Contribute on contribute button press', async () => {
      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      const contributeBtn = await findByText('dashboard.contribute');
      fireEvent.press(contributeBtn);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('Contribute');
    });
  });

  describe('empty activity state', () => {
    it('should show no activity message when recentContributions is empty', async () => {
      mockedGetDashboard.mockResolvedValue({
        success: true,
        data: { ...mockDashboard, recentContributions: [] },
      } as any);

      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('dashboard.noActivity')).toBeTruthy();
    });
  });

  describe('currency formatting edge cases', () => {
    it('should format large amounts in lakhs (L)', async () => {
      mockedGetDashboard.mockResolvedValue({
        success: true,
        data: { ...mockDashboard, totalContributedPaise: 15000000 },
      } as any);

      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      // 15000000 paise = ₹1,50,000 = ₹1.5L
      expect(await findByText('₹1.5L')).toBeTruthy();
    });

    it('should format zero contributions correctly', async () => {
      mockedGetDashboard.mockResolvedValue({
        success: true,
        data: { ...mockDashboard, totalContributedPaise: 0 },
      } as any);

      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('₹0')).toBeTruthy();
    });

    it('should format small amounts (below 1K) without suffix', async () => {
      mockedGetDashboard.mockResolvedValue({
        success: true,
        data: { ...mockDashboard, totalContributedPaise: 75000, recentContributions: [] },
      } as any);

      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      // 75000 paise = ₹750
      expect(await findByText('₹750')).toBeTruthy();
    });
  });

  describe('coverage progress bar thresholds', () => {
    it('should show "Excellent coverage" for rate >= 75', async () => {
      mockedGetDashboard.mockResolvedValue({
        success: true,
        data: { ...mockDashboard, coverageRate: 80 },
      } as any);

      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('Excellent coverage')).toBeTruthy();
    });

    it('should show "Consider enrolling more workers" for rate < 50', async () => {
      mockedGetDashboard.mockResolvedValue({
        success: true,
        data: { ...mockDashboard, coverageRate: 30 },
      } as any);

      const { findByText } = render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(await findByText('Consider enrolling more workers')).toBeTruthy();
    });
  });

  describe('no partner in auth store', () => {
    it('should not fetch dashboard when partner is null', () => {
      useAuthStore.setState({ partner: null });

      render(
        <DashboardScreen navigation={mockNavigation as any} />,
        { wrapper: createWrapper() },
      );

      expect(mockedGetDashboard).not.toHaveBeenCalled();
    });
  });
});
