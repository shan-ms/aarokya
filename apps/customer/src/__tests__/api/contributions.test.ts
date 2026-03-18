/**
 * ART: Contributions API Tests
 *
 * Tests contribution API calls (create, list, summary)
 * with mocked axios client.
 */

import client from '../../api/client';
import {
  createContribution,
  listContributions,
  getContributionSummary,
} from '../../api/contributions';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

const mockedClient = client as jest.Mocked<typeof client>;

describe('Contributions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createContribution', () => {
    it('should POST to /contributions with amount in paise', async () => {
      const contributionData = {
        amount: 50000, // 500.00 INR
        source: 'self' as const,
        description: 'Monthly saving',
        paymentMethod: 'upi',
      };

      const mockResponse = {
        data: {
          data: {
            id: 'contrib-001',
            hsaId: 'hsa-001',
            amount: 50000,
            source: 'self',
            status: 'completed',
            description: 'Monthly saving',
            createdAt: '2025-03-01T10:00:00Z',
          },
        },
      };

      (mockedClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await createContribution(contributionData);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/contributions',
        contributionData,
      );
      expect(result.data.amount).toBe(50000);
      expect(result.data.source).toBe('self');
      expect(result.data.status).toBe('completed');
    });

    it('should handle employer contribution source', async () => {
      const data = {
        amount: 100000, // 1,000.00 INR
        source: 'employer' as const,
      };

      const mockResponse = {
        data: {
          data: {
            id: 'contrib-002',
            hsaId: 'hsa-001',
            amount: 100000,
            source: 'employer',
            status: 'pending',
            createdAt: '2025-03-01T10:00:00Z',
          },
        },
      };

      (mockedClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await createContribution(data);

      expect(result.data.source).toBe('employer');
      expect(result.data.amount).toBe(100000);
    });

    it('should propagate payment failure error', async () => {
      const error = {
        response: { status: 402, data: { message: 'Payment failed' } },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        createContribution({ amount: 50000, source: 'self' }),
      ).rejects.toEqual(error);
    });

    it('should propagate validation error for zero amount', async () => {
      const error = {
        response: {
          status: 422,
          data: { message: 'Amount must be greater than 0' },
        },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        createContribution({ amount: 0, source: 'self' }),
      ).rejects.toEqual(error);
    });
  });

  describe('listContributions', () => {
    it('should GET /contributions with pagination params', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'contrib-001',
              hsaId: 'hsa-001',
              amount: 50000,
              source: 'self',
              status: 'completed',
              createdAt: '2025-03-01T10:00:00Z',
            },
          ],
          total: 25,
          page: 1,
          pageSize: 20,
          hasMore: true,
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await listContributions({ page: 1, pageSize: 20 });

      expect(mockedClient.get).toHaveBeenCalledWith('/contributions', {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(25);
      expect(result.hasMore).toBe(true);
    });

    it('should support filtering by source', async () => {
      const mockResponse = {
        data: {
          data: [],
          total: 0,
          page: 1,
          pageSize: 20,
          hasMore: false,
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await listContributions({ source: 'employer' });

      expect(mockedClient.get).toHaveBeenCalledWith('/contributions', {
        params: { source: 'employer' },
      });
    });

    it('should support date range filtering', async () => {
      const mockResponse = {
        data: {
          data: [],
          total: 0,
          page: 1,
          pageSize: 20,
          hasMore: false,
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await listContributions({
        startDate: '2025-01-01',
        endDate: '2025-03-31',
      });

      expect(mockedClient.get).toHaveBeenCalledWith('/contributions', {
        params: { startDate: '2025-01-01', endDate: '2025-03-31' },
      });
    });

    it('should handle empty contributions list', async () => {
      const mockResponse = {
        data: {
          data: [],
          total: 0,
          page: 1,
          pageSize: 20,
          hasMore: false,
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await listContributions();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should propagate server errors', async () => {
      (mockedClient.get as jest.Mock).mockRejectedValue(
        new Error('Internal Server Error'),
      );

      await expect(listContributions()).rejects.toThrow(
        'Internal Server Error',
      );
    });
  });

  describe('getContributionSummary', () => {
    it('should GET /contributions/summary', async () => {
      const mockResponse = {
        data: {
          data: {
            total: 750000,
            bySelf: 400000,
            byEmployer: 200000,
            byGovernment: 50000,
            byCashback: 100000,
            byReferral: 0,
            monthlyAverage: 62500,
            streak: 12,
          },
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getContributionSummary();

      expect(mockedClient.get).toHaveBeenCalledWith('/contributions/summary');
      expect(result.data.total).toBe(750000);
      expect(result.data.monthlyAverage).toBe(62500);
      expect(result.data.streak).toBe(12);
    });

    it('should return zero summary for new user', async () => {
      const mockResponse = {
        data: {
          data: {
            total: 0,
            bySelf: 0,
            byEmployer: 0,
            byGovernment: 0,
            byCashback: 0,
            byReferral: 0,
            monthlyAverage: 0,
            streak: 0,
          },
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getContributionSummary();

      expect(result.data.total).toBe(0);
      expect(result.data.streak).toBe(0);
    });

    it('should propagate errors', async () => {
      (mockedClient.get as jest.Mock).mockRejectedValue(
        new Error('Unauthorized'),
      );

      await expect(getContributionSummary()).rejects.toThrow('Unauthorized');
    });
  });
});
