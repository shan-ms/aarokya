/**
 * ART: ContributeScreen Tests
 *
 * Tests the contribution screen: tab switching (individual/bulk),
 * worker selection, amount input, source type selection,
 * form validation, total calculation, navigation.
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ContributeScreen from '../../screens/ContributeScreen';
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

const defaultRoute = { params: {} };

describe('ContributeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useAuthStore.setState({
      partner: mockPartner,
      isAuthenticated: true,
      token: 'test-token',
      refreshToken: 'test-refresh',
      isNewPartner: false,
    });

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

  describe('tab rendering', () => {
    it('should display individual and bulk tabs', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      expect(getByText('contribute.individual')).toBeTruthy();
      expect(getByText('contribute.bulk')).toBeTruthy();
    });

    it('should default to individual tab', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      // In individual mode, the section title is "Select Worker" (singular)
      expect(getByText('Select Worker')).toBeTruthy();
    });

    it('should switch to bulk tab on press', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('contribute.bulk'));

      // In bulk mode, section title is "Select Workers" (plural)
      expect(getByText('Select Workers')).toBeTruthy();
    });

    it('should clear selected workers on tab switch', () => {
      const { getByText, queryByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      // Select a worker in individual mode
      fireEvent.press(getByText('Ramesh Kumar'));
      expect(getByText(/1 worker.* selected/)).toBeTruthy();

      // Switch to bulk tab
      fireEvent.press(getByText('contribute.bulk'));

      // Selection should be cleared
      expect(queryByText(/worker.* selected/)).toBeNull();
    });
  });

  describe('worker selection', () => {
    it('should display worker names as selectable chips', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      expect(getByText('Ramesh Kumar')).toBeTruthy();
      expect(getByText('Suresh Patel')).toBeTruthy();
      expect(getByText('Priya Singh')).toBeTruthy();
    });

    it('should show selected count when worker is selected', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('Ramesh Kumar'));

      expect(getByText('1 worker selected')).toBeTruthy();
    });

    it('should allow only one selection in individual mode', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.press(getByText('Suresh Patel'));

      // In individual mode, only last selected should remain
      expect(getByText('1 worker selected')).toBeTruthy();
    });

    it('should allow multiple selection in bulk mode', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      // Switch to bulk mode
      fireEvent.press(getByText('contribute.bulk'));

      // Select multiple workers
      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.press(getByText('Suresh Patel'));

      expect(getByText('2 workers selected')).toBeTruthy();
    });

    it('should toggle worker deselection in bulk mode', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('contribute.bulk'));

      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.press(getByText('Suresh Patel'));
      expect(getByText('2 workers selected')).toBeTruthy();

      // Deselect one
      fireEvent.press(getByText('Ramesh Kumar'));
      expect(getByText('1 worker selected')).toBeTruthy();
    });
  });

  describe('contribution form', () => {
    it('should display amount input', () => {
      const { getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      expect(getByPlaceholderText('Enter amount')).toBeTruthy();
    });

    it('should display amount label for individual mode', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      expect(getByText('Amount (₹)')).toBeTruthy();
    });

    it('should display amount per worker label in bulk mode', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('contribute.bulk'));

      expect(getByText('Amount Per Worker (₹)')).toBeTruthy();
    });

    it('should display source type options', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      expect(getByText('Employer')).toBeTruthy();
      expect(getByText('Platform Fee')).toBeTruthy();
      expect(getByText('CSR')).toBeTruthy();
      expect(getByText('Grant')).toBeTruthy();
    });

    it('should show total amount when worker selected and amount entered', () => {
      const { getByText, getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.changeText(getByPlaceholderText('Enter amount'), '500');

      expect(getByText('Total')).toBeTruthy();
      expect(getByText('₹500')).toBeTruthy();
    });

    it('should calculate bulk total correctly (workers * amount)', () => {
      const { getByText, getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('contribute.bulk'));
      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.press(getByText('Suresh Patel'));
      fireEvent.changeText(getByPlaceholderText('Enter amount'), '250');

      // 2 workers * ₹250 = ₹500
      expect(getByText('₹500')).toBeTruthy();
    });

    it('should display Proceed to Payment button', () => {
      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      expect(getByText('Proceed to Payment')).toBeTruthy();
    });
  });

  describe('form validation', () => {
    it('should show error for invalid amount on submit', () => {
      const { getByText, getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.changeText(getByPlaceholderText('Enter amount'), '0');
      fireEvent.press(getByText('Proceed to Payment'));

      expect(getByText('Please enter a valid amount')).toBeTruthy();
    });

    it('should show error when no worker selected', () => {
      const { getByText, getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.changeText(getByPlaceholderText('Enter amount'), '500');
      fireEvent.press(getByText('Proceed to Payment'));

      expect(getByText('Please select at least one worker')).toBeTruthy();
    });
  });

  describe('navigation on submit', () => {
    it('should navigate to PaymentConfirm with correct params (individual)', () => {
      const { getByText, getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.changeText(getByPlaceholderText('Enter amount'), '500');
      fireEvent.press(getByText('Proceed to Payment'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('PaymentConfirm', {
        workerIds: ['w-1'],
        amountPerWorkerPaise: 50000, // ₹500 = 50000 paise
        sourceType: 'employer',
        mode: 'individual',
      });
    });

    it('should navigate to PaymentConfirm with correct params (bulk)', () => {
      const { getByText, getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('contribute.bulk'));
      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.press(getByText('Suresh Patel'));
      fireEvent.changeText(getByPlaceholderText('Enter amount'), '250');
      fireEvent.press(getByText('Proceed to Payment'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('PaymentConfirm', {
        workerIds: ['w-1', 'w-2'],
        amountPerWorkerPaise: 25000, // ₹250 = 25000 paise
        sourceType: 'employer',
        mode: 'bulk',
      });
    });

    it('should convert rupee amount to paise correctly', () => {
      const { getByText, getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.changeText(getByPlaceholderText('Enter amount'), '39.99');
      fireEvent.press(getByText('Proceed to Payment'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('PaymentConfirm', {
        workerIds: ['w-1'],
        amountPerWorkerPaise: 3999, // ₹39.99 = 3999 paise
        sourceType: 'employer',
        mode: 'individual',
      });
    });

    it('should navigate with selected source type', () => {
      const { getByText, getByPlaceholderText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      fireEvent.press(getByText('Ramesh Kumar'));
      fireEvent.changeText(getByPlaceholderText('Enter amount'), '100');
      fireEvent.press(getByText('CSR'));
      fireEvent.press(getByText('Proceed to Payment'));

      expect(mockNavigation.navigate).toHaveBeenCalledWith('PaymentConfirm', {
        workerIds: ['w-1'],
        amountPerWorkerPaise: 10000,
        sourceType: 'csr',
        mode: 'individual',
      });
    });
  });

  describe('preselected worker', () => {
    it('should preselect worker from route params', () => {
      const routeWithPreselection = {
        params: { preselectedWorkerId: 'w-2' },
      };

      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={routeWithPreselection as any}
        />,
      );

      expect(getByText('1 worker selected')).toBeTruthy();
    });
  });

  describe('loading state', () => {
    it('should show loading spinner when workers are loading with no data', () => {
      usePartnerStore.setState({
        workers: [],
        workersLoading: true,
      });

      const { getByText } = render(
        <ContributeScreen
          navigation={mockNavigation as any}
          route={defaultRoute as any}
        />,
      );

      expect(getByText('common.loading')).toBeTruthy();
    });
  });
});
