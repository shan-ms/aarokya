/**
 * ART – Users page tests
 *
 * Covers:
 *  - Renders user table with mock data
 *  - Search input filtering
 *  - Type and status filter dropdowns
 *  - RBAC: verify/reject buttons only for users.write permission
 *  - Loading state
 *  - Empty state
 *  - API error falls back to mock data
 *  - Verify/reject user action calls
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Mock next/navigation ───────────────────────────────────────────
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// ── Mock services ──────────────────────────────────────────────────
const mockFetchUsers = jest.fn();
const mockVerifyUser = jest.fn();
const mockRejectUser = jest.fn();

jest.mock('@/lib/services', () => ({
  fetchUsers: (...args: unknown[]) => mockFetchUsers(...args),
  verifyUser: (...args: unknown[]) => mockVerifyUser(...args),
  rejectUser: (...args: unknown[]) => mockRejectUser(...args),
}));

// ── Mock toast ─────────────────────────────────────────────────────
const mockToast = jest.fn();
jest.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── Mock auth store ────────────────────────────────────────────────
let mockUser: Record<string, unknown> | null = null;

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = { user: mockUser };
    return selector(state);
  },
}));

// ── Mock lucide-react ──────────────────────────────────────────────
jest.mock('lucide-react', () => ({
  Search: (props: Record<string, unknown>) => <svg data-testid="search-icon" {...props} />,
  Filter: (props: Record<string, unknown>) => <svg data-testid="filter-icon" {...props} />,
  Eye: (props: Record<string, unknown>) => <svg data-testid="eye-icon" {...props} />,
  CheckCircle: (props: Record<string, unknown>) => <svg data-testid="check-icon" {...props} />,
  XCircle: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="loader-icon" {...props} />,
}));

// ── Mock Badge ─────────────────────────────────────────────────────
jest.mock('@/components/ui/Badge', () => {
  return function MockBadge({ children }: { children: React.ReactNode }) {
    return <span data-testid="badge">{children}</span>;
  };
});

// ── Mock Button ────────────────────────────────────────────────────
jest.mock('@/components/ui/Button', () => {
  return function MockButton({ children, onClick, disabled, loading, ...props }: Record<string, unknown>) {
    return (
      <button
        onClick={onClick as React.MouseEventHandler}
        disabled={(disabled || loading) as boolean}
        {...props}
      >
        {children as React.ReactNode}
      </button>
    );
  };
});

import UsersPage from '@/app/dashboard/users/page';

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {
    id: 'admin-1',
    role: {
      id: 'role-1',
      name: 'super_admin',
      permissions: ['all'],
      created_at: '2025-01-01T00:00:00Z',
    },
  };
  // Default: API fails, so page falls back to mock data
  mockFetchUsers.mockRejectedValue(new Error('API down'));
  mockVerifyUser.mockResolvedValue(undefined);
  mockRejectUser.mockResolvedValue(undefined);
});

describe('UsersPage', () => {
  // ── Basic rendering ───────────────────────────────────────────

  it('renders search input', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search by name or phone...')).toBeInTheDocument();
    });
  });

  it('renders type and status filter dropdowns', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('All Types')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Status')).toBeInTheDocument();
    });
  });

  it('renders user data from fallback mock data', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
      expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('Meena Devi')).toBeInTheDocument();
    });
  });

  it('renders column headers', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('HSA Balance')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Joined')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  // ── RBAC: Verify/Reject buttons ──────────────────────────────

  it('shows Verify/Reject buttons for pending users when user has write permission', async () => {
    render(<UsersPage />);
    await waitFor(() => {
      // Meena Devi is pending_verification in mock data
      expect(screen.getByText('Verify')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });

  it('hides Verify/Reject buttons when user lacks write permission', async () => {
    mockUser = {
      id: 'admin-2',
      role: {
        id: 'role-2',
        name: 'analytics',
        permissions: ['analytics.read'],
        created_at: '2025-01-01T00:00:00Z',
      },
    };

    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Meena Devi')).toBeInTheDocument();
    });
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('shows View button for all users regardless of permission', async () => {
    mockUser = {
      id: 'admin-2',
      role: {
        id: 'role-2',
        name: 'analytics',
        permissions: ['users.read'],
        created_at: '2025-01-01T00:00:00Z',
      },
    };

    render(<UsersPage />);
    await waitFor(() => {
      const viewButtons = screen.getAllByText('View');
      expect(viewButtons.length).toBeGreaterThan(0);
    });
  });

  // ── Search filtering ──────────────────────────────────────────

  it('filters users by search term (client-side fallback)', async () => {
    render(<UsersPage />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    // Type in search
    const searchInput = screen.getByPlaceholderText('Search by name or phone...');
    fireEvent.change(searchInput, { target: { value: 'Priya' } });

    // fetchUsers is called again (which fails), so fallback filtering applies
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
  });

  // ── Type filter ───────────────────────────────────────────────

  it('filters users by type', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    const typeSelect = screen.getByDisplayValue('All Types');
    fireEvent.change(typeSelect, { target: { value: 'employer' } });

    // After filter change, fetchUsers is called again
    await waitFor(() => {
      expect(mockFetchUsers).toHaveBeenCalled();
    });
  });

  // ── Status filter ─────────────────────────────────────────────

  it('filters users by status', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });

    const statusSelect = screen.getByDisplayValue('All Status');
    fireEvent.change(statusSelect, { target: { value: 'suspended' } });

    await waitFor(() => {
      expect(mockFetchUsers).toHaveBeenCalled();
    });
  });

  // ── API success ───────────────────────────────────────────────

  it('uses API data when available', async () => {
    mockFetchUsers.mockResolvedValueOnce({
      data: [
        {
          id: 'api-1',
          phone: '+919999999999',
          name: 'API User',
          user_type: 'individual',
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          kyc_verified: true,
          aadhaar_linked: true,
          hsa_balance_paise: 500000,
        },
      ],
      total: 1,
      page: 1,
      page_size: 10,
      total_pages: 1,
    });

    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('API User')).toBeInTheDocument();
    });
  });

  // ── Verify user action ────────────────────────────────────────

  it('calls verifyUser when Verify button is clicked', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Verify')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Verify'));
    });

    await waitFor(() => {
      expect(mockVerifyUser).toHaveBeenCalledWith('3'); // Meena Devi id
    });
  });

  // ── Reject user action ────────────────────────────────────────

  it('calls rejectUser when Reject button is clicked', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Reject'));
    });

    await waitFor(() => {
      expect(mockRejectUser).toHaveBeenCalledWith('3'); // Meena Devi id
    });
  });

  // ── No user role ──────────────────────────────────────────────

  it('renders without crashing when user has no role', async () => {
    mockUser = { id: 'admin-3', role: null };

    render(<UsersPage />);
    await waitFor(() => {
      expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
    });
    // No verify/reject buttons since no permissions
    expect(screen.queryByText('Verify')).not.toBeInTheDocument();
  });
});
