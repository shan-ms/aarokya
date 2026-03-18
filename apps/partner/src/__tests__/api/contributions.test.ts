/**
 * ART: Contributions API Tests
 *
 * Tests contribution API calls: createContribution, bulkContribute,
 * getContributionHistory, getReports.
 */

import apiClient from '../../api/client';
import {
  createContribution,
  bulkContribute,
  getContributionHistory,
  getReports,
} from '../../api/contributions';

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

const PARTNER_ID = 'partner-001';

describe('Contributions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createContribution', () => {
    it('should POST to /partners/:id/contributions', async () => {
      const payload = {
        workerId: 'worker-001',
        amountPaise: 50000,
        sourceType: 'employer' as const,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'contrib-001',
            workerId: 'worker-001',
            workerName: 'Ramesh Kumar',
            partnerId: PARTNER_ID,
            amountPaise: 50000,
            sourceType: 'employer',
            status: 'pending',
            createdAt: '2025-12-20T10:00:00Z',
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await createContribution(PARTNER_ID, payload);

      expect(mockedPost).toHaveBeenCalledWith(
        `/partners/${PARTNER_ID}/contributions`,
        payload,
      );
      expect(result.data.id).toBe('contrib-001');
      // 50000 paise = ₹500
      expect(result.data.amountPaise).toBe(50000);
      expect(result.data.amountPaise / 100).toBe(500);
      expect(result.data.status).toBe('pending');
    });

    it('should handle different source types', async () => {
      const sourceTypes = ['employer', 'platform_fee', 'csr', 'grant'] as const;

      for (const sourceType of sourceTypes) {
        mockedPost.mockResolvedValue({
          data: {
            success: true,
            data: { id: `contrib-${sourceType}`, sourceType },
          },
        });

        const result = await createContribution(PARTNER_ID, {
          workerId: 'worker-001',
          amountPaise: 10000,
          sourceType,
        });

        expect(result.data.sourceType).toBe(sourceType);
      }
    });

    it('should propagate error for insufficient funds', async () => {
      mockedPost.mockRejectedValue(new Error('Insufficient funds'));

      await expect(
        createContribution(PARTNER_ID, {
          workerId: 'worker-001',
          amountPaise: 50000,
          sourceType: 'employer',
        }),
      ).rejects.toThrow('Insufficient funds');
    });
  });

  describe('bulkContribute', () => {
    it('should POST to /partners/:id/contributions/bulk', async () => {
      const payload = {
        workerIds: ['w-1', 'w-2', 'w-3'],
        amountPerWorkerPaise: 25000,
        sourceType: 'employer' as const,
      };
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'bulk-001',
            partnerId: PARTNER_ID,
            workerIds: ['w-1', 'w-2', 'w-3'],
            amountPerWorkerPaise: 25000,
            totalAmountPaise: 75000,
            sourceType: 'employer',
            status: 'processing',
            successCount: 0,
            failureCount: 0,
            createdAt: '2025-12-20T10:00:00Z',
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await bulkContribute(PARTNER_ID, payload);

      expect(mockedPost).toHaveBeenCalledWith(
        `/partners/${PARTNER_ID}/contributions/bulk`,
        payload,
      );
      expect(result.data.workerIds).toHaveLength(3);
      // Total: 3 workers * 25000 paise = 75000 paise = ₹750
      expect(result.data.totalAmountPaise).toBe(75000);
      expect(result.data.totalAmountPaise / 100).toBe(750);
      expect(result.data.amountPerWorkerPaise / 100).toBe(250);
    });

    it('should handle partial failure response', async () => {
      mockedPost.mockResolvedValue({
        data: {
          success: true,
          data: {
            id: 'bulk-002',
            partnerId: PARTNER_ID,
            workerIds: ['w-1', 'w-2'],
            amountPerWorkerPaise: 10000,
            totalAmountPaise: 20000,
            sourceType: 'csr',
            status: 'partial_failure',
            successCount: 1,
            failureCount: 1,
            createdAt: '2025-12-20T10:00:00Z',
          },
        },
      });

      const result = await bulkContribute(PARTNER_ID, {
        workerIds: ['w-1', 'w-2'],
        amountPerWorkerPaise: 10000,
        sourceType: 'csr',
      });

      expect(result.data.status).toBe('partial_failure');
      expect(result.data.successCount).toBe(1);
      expect(result.data.failureCount).toBe(1);
    });

    it('should propagate error for empty worker list', async () => {
      mockedPost.mockRejectedValue(new Error('At least one worker required'));

      await expect(
        bulkContribute(PARTNER_ID, {
          workerIds: [],
          amountPerWorkerPaise: 10000,
          sourceType: 'employer',
        }),
      ).rejects.toThrow('At least one worker required');
    });
  });

  describe('getContributionHistory', () => {
    it('should GET /partners/:id/contributions with params', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            items: [
              {
                id: 'c-1',
                workerId: 'w-1',
                workerName: 'Ramesh',
                amountPaise: 50000,
                status: 'completed',
              },
            ],
            total: 100,
            page: 1,
            pageSize: 20,
            hasMore: true,
          },
        },
      };
      mockedGet.mockResolvedValue(mockResponse);

      const result = await getContributionHistory(PARTNER_ID, {
        page: 1,
        pageSize: 20,
        workerId: 'w-1',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      expect(mockedGet).toHaveBeenCalledWith(
        `/partners/${PARTNER_ID}/contributions`,
        {
          params: {
            page: 1,
            pageSize: 20,
            workerId: 'w-1',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
          },
        },
      );
      expect(result.data.items).toHaveLength(1);
      expect(result.data.total).toBe(100);
    });

    it('should work without optional params', async () => {
      mockedGet.mockResolvedValue({
        data: {
          success: true,
          data: { items: [], total: 0, page: 1, pageSize: 20, hasMore: false },
        },
      });

      await getContributionHistory(PARTNER_ID);

      expect(mockedGet).toHaveBeenCalledWith(
        `/partners/${PARTNER_ID}/contributions`,
        { params: undefined },
      );
    });

    it('should verify all contribution amounts are in paise', async () => {
      const contributions = [
        { id: 'c-1', amountPaise: 50000 },
        { id: 'c-2', amountPaise: 100000 },
        { id: 'c-3', amountPaise: 399900 }, // ₹3,999 - basic insurance threshold
      ];
      mockedGet.mockResolvedValue({
        data: {
          success: true,
          data: {
            items: contributions,
            total: 3,
            page: 1,
            pageSize: 20,
            hasMore: false,
          },
        },
      });

      const result = await getContributionHistory(PARTNER_ID);

      expect(result.data.items[0].amountPaise / 100).toBe(500);
      expect(result.data.items[1].amountPaise / 100).toBe(1000);
      expect(result.data.items[2].amountPaise / 100).toBe(3999);
    });
  });

  describe('getReports', () => {
    it('should GET /partners/:id/reports with date params', async () => {
      const mockReports = [
        {
          id: 'report-1',
          partnerId: PARTNER_ID,
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          totalAmountPaise: 1500000,
          workerCount: 30,
          contributionCount: 45,
          createdAt: '2025-02-01T00:00:00Z',
        },
      ];
      mockedGet.mockResolvedValue({
        data: { success: true, data: mockReports },
      });

      const result = await getReports(PARTNER_ID, {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      expect(mockedGet).toHaveBeenCalledWith(`/partners/${PARTNER_ID}/reports`, {
        params: { startDate: '2025-01-01', endDate: '2025-01-31' },
      });
      expect(result.data).toHaveLength(1);
      // 1500000 paise = ₹15,000
      expect(result.data[0].totalAmountPaise / 100).toBe(15000);
    });

    it('should work without date params', async () => {
      mockedGet.mockResolvedValue({
        data: { success: true, data: [] },
      });

      await getReports(PARTNER_ID);

      expect(mockedGet).toHaveBeenCalledWith(`/partners/${PARTNER_ID}/reports`, {
        params: undefined,
      });
    });
  });
});
