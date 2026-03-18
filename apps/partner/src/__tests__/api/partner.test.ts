/**
 * ART: Partner API Tests
 *
 * Tests partner API calls: registerPartner, getPartner, getDashboard.
 */

import apiClient from '../../api/client';
import { registerPartner, getPartner, getDashboard } from '../../api/partner';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('Partner API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerPartner', () => {
    const payload = {
      phone: '+919876543210',
      businessName: 'Acme Logistics',
      registrationNumber: 'CIN-U12345',
      partnerType: 'gig_platform' as const,
      contributionSchemeType: 'per_task' as const,
      contributionAmountPaise: 5000,
    };

    it('should POST to /partners with registration payload', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'partner-001',
            phone: '+919876543210',
            businessName: 'Acme Logistics',
            registrationNumber: 'CIN-U12345',
            partnerType: 'gig_platform',
            contributionScheme: { type: 'per_task', amountPaise: 5000 },
            totalWorkers: 0,
            totalContributedPaise: 0,
            createdAt: '2025-01-15T10:00:00Z',
            updatedAt: '2025-01-15T10:00:00Z',
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await registerPartner(payload);

      expect(mockedPost).toHaveBeenCalledWith('/partners', payload);
      expect(result.data.id).toBe('partner-001');
      expect(result.data.businessName).toBe('Acme Logistics');
    });

    it('should handle contribution amount in paise', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'partner-002',
            contributionScheme: { type: 'per_task', amountPaise: 5000 },
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await registerPartner(payload);

      // 5000 paise = ₹50
      expect(result.data.contributionScheme.amountPaise).toBe(5000);
      expect(result.data.contributionScheme.amountPaise / 100).toBe(50);
    });

    it('should propagate validation errors', async () => {
      mockedPost.mockRejectedValue(new Error('Registration number already exists'));

      await expect(registerPartner(payload)).rejects.toThrow(
        'Registration number already exists',
      );
    });
  });

  describe('getPartner', () => {
    it('should GET /partners/:id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'partner-001',
            businessName: 'Acme Logistics',
            totalWorkers: 150,
            totalContributedPaise: 7500000,
          },
        },
      };
      mockedGet.mockResolvedValue(mockResponse);

      const result = await getPartner('partner-001');

      expect(mockedGet).toHaveBeenCalledWith('/partners/partner-001');
      expect(result.data.totalWorkers).toBe(150);
      // 7500000 paise = ₹75,000
      expect(result.data.totalContributedPaise / 100).toBe(75000);
    });

    it('should propagate 404 error for unknown partner', async () => {
      mockedGet.mockRejectedValue(new Error('Partner not found'));

      await expect(getPartner('nonexistent')).rejects.toThrow('Partner not found');
    });
  });

  describe('getDashboard', () => {
    it('should GET /partners/:id/dashboard', async () => {
      const dashboardData = {
        totalWorkers: 150,
        totalContributedPaise: 7500000,
        coverageRate: 72,
        recentContributions: [],
        monthlyTrendPaise: [500000, 600000, 700000],
      };
      const mockResponse = {
        data: { success: true, data: dashboardData },
      };
      mockedGet.mockResolvedValue(mockResponse);

      const result = await getDashboard('partner-001');

      expect(mockedGet).toHaveBeenCalledWith('/partners/partner-001/dashboard');
      expect(result.data.totalWorkers).toBe(150);
      expect(result.data.coverageRate).toBe(72);
      expect(result.data.monthlyTrendPaise).toHaveLength(3);
    });

    it('should handle dashboard with zero values', async () => {
      const emptyDashboard = {
        totalWorkers: 0,
        totalContributedPaise: 0,
        coverageRate: 0,
        recentContributions: [],
        monthlyTrendPaise: [],
      };
      mockedGet.mockResolvedValue({
        data: { success: true, data: emptyDashboard },
      });

      const result = await getDashboard('partner-new');

      expect(result.data.totalWorkers).toBe(0);
      expect(result.data.totalContributedPaise).toBe(0);
      expect(result.data.coverageRate).toBe(0);
    });

    it('should propagate API errors', async () => {
      mockedGet.mockRejectedValue(new Error('Internal Server Error'));

      await expect(getDashboard('partner-001')).rejects.toThrow('Internal Server Error');
    });
  });
});
