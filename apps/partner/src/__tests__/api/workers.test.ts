/**
 * ART: Workers API Tests
 *
 * Tests workers API calls: addWorker, listWorkers, getWorkerDetail, searchWorker.
 */

import apiClient from '../../api/client';
import { addWorker, listWorkers, getWorkerDetail, searchWorker } from '../../api/workers';

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

describe('Workers API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addWorker', () => {
    it('should POST to /partners/:id/workers with phone', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'worker-new',
            name: 'Suresh',
            phone: '+919876000001',
            hsaBalancePaise: 0,
            insuranceStatus: 'none',
            totalContributionsFromPartnerPaise: 0,
            createdAt: '2025-12-20T00:00:00Z',
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await addWorker(PARTNER_ID, { phone: '+919876000001' });

      expect(mockedPost).toHaveBeenCalledWith(`/partners/${PARTNER_ID}/workers`, {
        phone: '+919876000001',
      });
      expect(result.data.id).toBe('worker-new');
      expect(result.data.hsaBalancePaise).toBe(0);
    });

    it('should POST with ABHA ID', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 'worker-abha', name: 'Rajesh' },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      await addWorker(PARTNER_ID, { abhaId: 'ABHA-12345' });

      expect(mockedPost).toHaveBeenCalledWith(`/partners/${PARTNER_ID}/workers`, {
        abhaId: 'ABHA-12345',
      });
    });

    it('should propagate error when worker already exists', async () => {
      mockedPost.mockRejectedValue(new Error('Worker already linked'));

      await expect(
        addWorker(PARTNER_ID, { phone: '+919876000001' }),
      ).rejects.toThrow('Worker already linked');
    });
  });

  describe('listWorkers', () => {
    it('should GET /partners/:id/workers with pagination params', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            items: [
              { id: 'w-1', name: 'Ramesh', phone: '+919876000001' },
              { id: 'w-2', name: 'Suresh', phone: '+919876000002' },
            ],
            total: 50,
            page: 1,
            pageSize: 20,
            hasMore: true,
          },
        },
      };
      mockedGet.mockResolvedValue(mockResponse);

      const result = await listWorkers(PARTNER_ID, { page: 1, pageSize: 20 });

      expect(mockedGet).toHaveBeenCalledWith(`/partners/${PARTNER_ID}/workers`, {
        params: { page: 1, pageSize: 20 },
      });
      expect(result.data.items).toHaveLength(2);
      expect(result.data.total).toBe(50);
      expect(result.data.hasMore).toBe(true);
    });

    it('should GET with search parameter', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            items: [{ id: 'w-1', name: 'Ramesh' }],
            total: 1,
            page: 1,
            pageSize: 20,
            hasMore: false,
          },
        },
      };
      mockedGet.mockResolvedValue(mockResponse);

      await listWorkers(PARTNER_ID, { page: 1, pageSize: 20, search: 'Ramesh' });

      expect(mockedGet).toHaveBeenCalledWith(`/partners/${PARTNER_ID}/workers`, {
        params: { page: 1, pageSize: 20, search: 'Ramesh' },
      });
    });

    it('should work without optional params', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { items: [], total: 0, page: 1, pageSize: 20, hasMore: false },
        },
      };
      mockedGet.mockResolvedValue(mockResponse);

      await listWorkers(PARTNER_ID);

      expect(mockedGet).toHaveBeenCalledWith(`/partners/${PARTNER_ID}/workers`, {
        params: undefined,
      });
    });

    it('should handle empty worker list', async () => {
      mockedGet.mockResolvedValue({
        data: {
          success: true,
          data: { items: [], total: 0, page: 1, pageSize: 20, hasMore: false },
        },
      });

      const result = await listWorkers(PARTNER_ID, { page: 1, pageSize: 20 });

      expect(result.data.items).toEqual([]);
      expect(result.data.total).toBe(0);
    });

    it('should propagate network errors', async () => {
      mockedGet.mockRejectedValue(new Error('Network Error'));

      await expect(listWorkers(PARTNER_ID, { page: 1 })).rejects.toThrow(
        'Network Error',
      );
    });
  });

  describe('getWorkerDetail', () => {
    it('should GET /partners/:partnerId/workers/:workerId', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'worker-001',
            name: 'Ramesh Kumar',
            phone: '+919876000001',
            hsaBalancePaise: 500000,
            insuranceStatus: 'active',
            totalContributionsFromPartnerPaise: 250000,
          },
        },
      };
      mockedGet.mockResolvedValue(mockResponse);

      const result = await getWorkerDetail(PARTNER_ID, 'worker-001');

      expect(mockedGet).toHaveBeenCalledWith(
        `/partners/${PARTNER_ID}/workers/worker-001`,
      );
      // 500000 paise = ₹5,000
      expect(result.data.hsaBalancePaise).toBe(500000);
      expect(result.data.hsaBalancePaise / 100).toBe(5000);
    });

    it('should propagate 404 for unknown worker', async () => {
      mockedGet.mockRejectedValue(new Error('Worker not found'));

      await expect(getWorkerDetail(PARTNER_ID, 'nonexistent')).rejects.toThrow(
        'Worker not found',
      );
    });
  });

  describe('searchWorker', () => {
    it('should GET /workers/search with query param', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: 'worker-found',
            name: 'Ramesh Kumar',
            phone: '+919876000001',
          },
        },
      };
      mockedGet.mockResolvedValue(mockResponse);

      const result = await searchWorker('+919876000001');

      expect(mockedGet).toHaveBeenCalledWith('/workers/search', {
        params: { q: '+919876000001' },
      });
      expect(result.data?.name).toBe('Ramesh Kumar');
    });

    it('should return null data when worker not found', async () => {
      mockedGet.mockResolvedValue({
        data: { success: true, data: null },
      });

      const result = await searchWorker('nonexistent');

      expect(result.data).toBeNull();
    });

    it('should search by ABHA ID', async () => {
      mockedGet.mockResolvedValue({
        data: {
          success: true,
          data: { id: 'worker-abha', name: 'Suresh' },
        },
      });

      await searchWorker('ABHA-12345');

      expect(mockedGet).toHaveBeenCalledWith('/workers/search', {
        params: { q: 'ABHA-12345' },
      });
    });
  });
});
