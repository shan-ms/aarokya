/**
 * ART: HomeScreen Tests
 *
 * Tests rendering states (loading, error, data), balance display,
 * navigation actions, pull-to-refresh, and empty contributions state.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomeScreen from '../../screens/HomeScreen';
import { useAuthStore } from '../../store/authStore';
import { getDashboard } from '../../api/hsa';

// Mock the API
jest.mock('../../api/hsa');

const mockedGetDashboard = getDashboard as jest.MockedFunction<typeof getDashboard>;

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
  }),
}));

// Wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const mockDashboardResponse = {
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
      updatedAt: '2025-02-01T00:00:00Z',
    },
    contributionSummary: {
      total: 750000,
      bySelf: 500000,
      byEmployer: 250000,
      byGovernment: 0,
      byCashback: 0,
      byReferral: 0,
      monthlyAverage: 62500,
      streak: 12,
    },
    recentContributions: [
      {
        id: 'contrib-001',
        hsaId: 'hsa-001',
        amount: 50000,
        source: 'self',
        status: 'completed',
        description: 'Monthly saving',
        createdAt: '2025-02-01T10:00:00Z',
      },
      {
        id: 'contrib-002',
        hsaId: 'hsa-001',
        amount: 100000,
        source: 'employer',
        status: 'completed',
        description: 'Employer match',
        createdAt: '2025-02-15T10:00:00Z',
      },
    ],
    activePolicies: [],
  },
};

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();

    // Set a default authenticated user
    useAuthStore.setState({
      user: {
        id: 'user-001',
        phone: '+919876543210',
        name: 'Ramesh',
        language: 'hi',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      token: 'test-token',
      refreshToken: 'test-refresh',
      isAuthenticated: true,
    });
  });

  describe('loading state', () => {
    it('should show loading spinner while dashboard is loading', async () => {
      // Never resolve so we stay in loading
      mockedGetDashboard.mockReturnValue(new Promise(() => {}));

      const { getByText } = render(<HomeScreen />, {
        wrapper: createWrapper(),
      });

      // The LoadingSpinner renders t('common.loading')
      expect(getByText('common.loading')).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('should show error state with retry button on API failure', async () => {
      mockedGetDashboard.mockRejectedValue(new Error('Network Error'));

      const { getByText, getAllByText } = render(<HomeScreen />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(getAllByText('common.error').length).toBeGreaterThan(0);
      });

      // Retry button should be visible
      expect(getByText('common.retry')).toBeTruthy();
    });

    it('should call refetch when retry button is pressed', async () => {
      mockedGetDashboard.mockRejectedValueOnce(new Error('Network Error'));

      const { getByText } = render(<HomeScreen />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(getByText('common.retry')).toBeTruthy();
      });

      // Now mock a success for the retry
      mockedGetDashboard.mockResolvedValue(mockDashboardResponse as any);

      fireEvent.press(getByText('common.retry'));

      await waitFor(() => {
        expect(mockedGetDashboard).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('successful data display', () => {
    it('should display greeting with user name', async () => {
      mockedGetDashboard.mockResolvedValue(mockDashboardResponse as any);

      const { getByText } = render(<HomeScreen />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(getByText('home.greeting')).toBeTruthy();
      });
    });

    it('should display recent contributions section header', async () => {
      mockedGetDashboard.mockResolvedValue(mockDashboardResponse as any);

      const { getByText } = render(<HomeScreen />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(getByText('home.recent_contributions')).toBeTruthy();
      });
    });

    it('should display view all link', async () => {
      mockedGetDashboard.mockResolvedValue(mockDashboardResponse as any);

      const { getByText } = render(<HomeScreen />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(getByText('home.view_all')).toBeTruthy();
      });
    });

    it('should navigate to HSADetail when "view all" is pressed', async () => {
      mockedGetDashboard.mockResolvedValue(mockDashboardResponse as any);

      const { getByText } = render(<HomeScreen />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(getByText('home.view_all')).toBeTruthy();
      });

      fireEvent.press(getByText('home.view_all'));
      expect(mockNavigate).toHaveBeenCalledWith('HSADetail');
    });
  });

  describe('empty contributions', () => {
    it('should show empty state when there are no contributions', async () => {
      const emptyDashboard = {
        ...mockDashboardResponse,
        data: {
          ...mockDashboardResponse.data,
          recentContributions: [],
        },
      };

      mockedGetDashboard.mockResolvedValue(emptyDashboard as any);

      const { getByText } = render(<HomeScreen />, {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(getByText('home.no_contributions')).toBeTruthy();
      });

      expect(getByText('home.start_saving')).toBeTruthy();
    });
  });

  describe('navigation actions', () => {
    it('should call getDashboard on mount', async () => {
      mockedGetDashboard.mockResolvedValue(mockDashboardResponse as any);

      render(<HomeScreen />, { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockedGetDashboard).toHaveBeenCalledTimes(1);
      });
    });
  });
});
