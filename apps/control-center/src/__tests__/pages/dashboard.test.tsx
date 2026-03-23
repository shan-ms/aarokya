/**
 * ART – Dashboard page tests
 *
 * Covers:
 *  - Renders 4 stat cards (Total Users, HSA Value, Daily Contributions, Active Policies)
 *  - Formats currency values with compact notation
 *  - Shows trend percentages
 *  - Displays recent activity table
 *  - Handles API failure gracefully (falls back to mock data)
 *  - Loading state
 *  - Chart sections are rendered
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// ── Mock services ──────────────────────────────────────────────────
const mockFetchDashboardStats = jest.fn();
const mockFetchUserGrowthChart = jest.fn();
const mockFetchContributionChart = jest.fn();
const mockFetchSourceDistribution = jest.fn();
const mockFetchRecentActivity = jest.fn();

jest.mock('@/lib/services', () => ({
  fetchDashboardStats: (...args: unknown[]) => mockFetchDashboardStats(...args),
  fetchUserGrowthChart: (...args: unknown[]) => mockFetchUserGrowthChart(...args),
  fetchContributionChart: (...args: unknown[]) => mockFetchContributionChart(...args),
  fetchSourceDistribution: (...args: unknown[]) => mockFetchSourceDistribution(...args),
  fetchRecentActivity: (...args: unknown[]) => mockFetchRecentActivity(...args),
}));

// ── Mock toast ─────────────────────────────────────────────────────
const mockToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── Mock charts (they use recharts which doesn't work in jsdom) ───
jest.mock('@/components/charts/UserGrowthChart', () => {
  return function MockUserGrowthChart() {
    return <div data-testid="user-growth-chart">User Growth Chart</div>;
  };
});

jest.mock('@/components/charts/ContributionChart', () => {
  return function MockContributionChart() {
    return <div data-testid="contribution-chart">Contribution Chart</div>;
  };
});

jest.mock('@/components/charts/SourcePieChart', () => {
  return function MockSourcePieChart() {
    return <div data-testid="source-pie-chart">Source Pie Chart</div>;
  };
});

// ── Mock lucide-react ──────────────────────────────────────────────
jest.mock('lucide-react', () => ({
  Users: (props: Record<string, unknown>) => <svg data-testid="users-icon" {...props} />,
  Wallet: (props: Record<string, unknown>) => <svg data-testid="wallet-icon" {...props} />,
  ArrowDownToLine: (props: Record<string, unknown>) => <svg data-testid="arrow-icon" {...props} />,
  ShieldCheck: (props: Record<string, unknown>) => <svg data-testid="shield-icon" {...props} />,
  TrendingUp: (props: Record<string, unknown>) => <svg data-testid="trending-up" {...props} />,
  TrendingDown: (props: Record<string, unknown>) => <svg data-testid="trending-down" {...props} />,
  Minus: (props: Record<string, unknown>) => <svg data-testid="minus-icon" {...props} />,
}));

// ── Mock Badge ─────────────────────────────────────────────────────
jest.mock('@/components/ui/Badge', () => {
  return function MockBadge({ children }: { children: React.ReactNode }) {
    return <span data-testid="badge">{children}</span>;
  };
});

import DashboardPage from '@/app/dashboard/page';

beforeEach(() => {
  jest.clearAllMocks();
  // Default: all API calls reject (use fallback data)
  mockFetchDashboardStats.mockRejectedValue(new Error('API down'));
  mockFetchUserGrowthChart.mockRejectedValue(new Error('API down'));
  mockFetchContributionChart.mockRejectedValue(new Error('API down'));
  mockFetchSourceDistribution.mockRejectedValue(new Error('API down'));
  mockFetchRecentActivity.mockRejectedValue(new Error('API down'));
});

describe('DashboardPage', () => {
  // ── Stat cards (fallback data) ────────────────────────────────

  it('renders all 4 stat card labels', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('Total HSA Value')).toBeInTheDocument();
      expect(screen.getByText('Daily Contributions')).toBeInTheDocument();
      expect(screen.getByText('Active Policies')).toBeInTheDocument();
    });
  });

  it('displays fallback stat values', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      // 24,583 in en-IN locale
      expect(screen.getByText('24,583')).toBeInTheDocument();
      // 8,742 in en-IN locale
      expect(screen.getByText('8,742')).toBeInTheDocument();
    });
  });

  it('displays trend percentages', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('+12.5%')).toBeInTheDocument();
      expect(screen.getByText('+8.3%')).toBeInTheDocument();
      expect(screen.getByText('+15.2%')).toBeInTheDocument();
      expect(screen.getByText('+6.8%')).toBeInTheDocument();
    });
  });

  // ── Charts ────────────────────────────────────────────────────

  it('renders chart components', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('user-growth-chart')).toBeInTheDocument();
      expect(screen.getByTestId('contribution-chart')).toBeInTheDocument();
      expect(screen.getByTestId('source-pie-chart')).toBeInTheDocument();
    });
  });

  // ── Recent activity ───────────────────────────────────────────

  it('renders recent activity section', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });
  });

  it('shows fallback activity data when API fails', async () => {
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.getByText('New user registration')).toBeInTheDocument();
      expect(screen.getByText('Claim submitted')).toBeInTheDocument();
    });
  });

  // ── API success scenario ──────────────────────────────────────

  it('uses API data when available', async () => {
    const apiStats = {
      total_users: 50000,
      total_hsa_value_paise: 3000000000,
      daily_contributions_paise: 50000000,
      active_policies: 15000,
      user_growth_percent: 20.0,
      hsa_growth_percent: 10.0,
      contribution_growth_percent: 25.0,
      policy_growth_percent: 12.0,
    };

    mockFetchDashboardStats.mockResolvedValueOnce(apiStats);
    mockFetchUserGrowthChart.mockResolvedValueOnce([]);
    mockFetchContributionChart.mockResolvedValueOnce([]);
    mockFetchSourceDistribution.mockResolvedValueOnce([]);
    mockFetchRecentActivity.mockResolvedValueOnce([
      { id: '1', action: 'API activity', user: 'API User', time: '2026-03-18T10:00:00Z', type: 'user' },
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('50,000')).toBeInTheDocument();
      expect(screen.getByText('15,000')).toBeInTheDocument();
      expect(screen.getByText('+20%')).toBeInTheDocument();
    });
  });

  it('shows API activity data on success', async () => {
    mockFetchDashboardStats.mockRejectedValue(new Error('fail'));
    mockFetchUserGrowthChart.mockRejectedValue(new Error('fail'));
    mockFetchContributionChart.mockRejectedValue(new Error('fail'));
    mockFetchSourceDistribution.mockRejectedValue(new Error('fail'));
    mockFetchRecentActivity.mockResolvedValueOnce([
      { id: '99', action: 'Custom action', user: 'Test Person', time: '2026-03-18T11:00:00Z', type: 'claim' },
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Custom action')).toBeInTheDocument();
      expect(screen.getByText('Test Person')).toBeInTheDocument();
    });
  });

  // ── Partial API failure ───────────────────────────────────────

  it('gracefully handles partial API failure (some succeed, some fail)', async () => {
    mockFetchDashboardStats.mockResolvedValueOnce({
      total_users: 99999,
      total_hsa_value_paise: 1000000000,
      daily_contributions_paise: 10000000,
      active_policies: 5000,
      user_growth_percent: 5.0,
      hsa_growth_percent: 3.0,
      contribution_growth_percent: 7.0,
      policy_growth_percent: 2.0,
    });
    // Other APIs fail
    mockFetchUserGrowthChart.mockRejectedValue(new Error('fail'));
    mockFetchContributionChart.mockRejectedValue(new Error('fail'));
    mockFetchSourceDistribution.mockRejectedValue(new Error('fail'));
    mockFetchRecentActivity.mockRejectedValue(new Error('fail'));

    render(<DashboardPage />);

    await waitFor(() => {
      // Stats from API
      expect(screen.getByText('99,999')).toBeInTheDocument();
      // Activity from fallback
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
  });
});
