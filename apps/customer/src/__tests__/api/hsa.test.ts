/**
 * ART: HSA API Tests
 *
 * Tests HSA API calls (getHsa, getDashboard, createHsa)
 * with mocked axios client.
 */

import client from '../../api/client';
import { getHsa, getDashboard, createHsa } from '../../api/hsa';

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

describe('HSA API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHsa', () => {
    it('should GET /hsa and return HSA data', async () => {
      const mockHsa = {
        data: {
          data: {
            id: 'hsa-001',
            userId: 'user-001',
            abhaId: 'ABHA-12345',
            balance: 500000,
            totalContributed: 750000,
            totalWithdrawn: 250000,
            insuranceEligible: true,
            insuranceThreshold: 399900,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-02-01T00:00:00Z',
          },
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockHsa);

      const result = await getHsa();

      expect(mockedClient.get).toHaveBeenCalledWith('/hsa');
      expect(result.data.balance).toBe(500000);
      expect(result.data.insuranceEligible).toBe(true);
    });

    it('should propagate error when HSA not found', async () => {
      const error = {
        response: { status: 404, data: { message: 'HSA not found' } },
      };
      (mockedClient.get as jest.Mock).mockRejectedValue(error);

      await expect(getHsa()).rejects.toEqual(error);
    });
  });

  describe('getDashboard', () => {
    it('should GET /hsa/dashboard and return full dashboard', async () => {
      const mockDashboard = {
        data: {
          data: {
            hsa: {
              id: 'hsa-001',
              balance: 500000,
              totalContributed: 750000,
              totalWithdrawn: 250000,
              insuranceEligible: true,
              insuranceThreshold: 399900,
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
            recentContributions: [],
            activePolicies: [],
          },
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockDashboard);

      const result = await getDashboard();

      expect(mockedClient.get).toHaveBeenCalledWith('/hsa/dashboard');
      expect(result.data.hsa.balance).toBe(500000);
      expect(result.data.contributionSummary.streak).toBe(12);
    });

    it('should propagate authorization error', async () => {
      const error = {
        response: { status: 401, data: { message: 'Unauthorized' } },
      };
      (mockedClient.get as jest.Mock).mockRejectedValue(error);

      await expect(getDashboard()).rejects.toEqual(error);
    });

    it('should propagate server errors', async () => {
      const error = {
        response: { status: 500, data: { message: 'Internal server error' } },
      };
      (mockedClient.get as jest.Mock).mockRejectedValue(error);

      await expect(getDashboard()).rejects.toEqual(error);
    });
  });

  describe('createHsa', () => {
    it('should POST to /hsa with ABHA ID', async () => {
      const mockCreated = {
        data: {
          data: {
            id: 'hsa-new',
            userId: 'user-001',
            abhaId: 'ABHA-99999',
            balance: 0,
            totalContributed: 0,
            totalWithdrawn: 0,
            insuranceEligible: false,
            insuranceThreshold: 399900,
            createdAt: '2025-03-01T00:00:00Z',
            updatedAt: '2025-03-01T00:00:00Z',
          },
        },
      };

      (mockedClient.post as jest.Mock).mockResolvedValue(mockCreated);

      const result = await createHsa('ABHA-99999');

      expect(mockedClient.post).toHaveBeenCalledWith('/hsa', {
        abhaId: 'ABHA-99999',
      });
      expect(result.data.balance).toBe(0);
      expect(result.data.abhaId).toBe('ABHA-99999');
    });

    it('should propagate duplicate HSA error', async () => {
      const error = {
        response: { status: 409, data: { message: 'HSA already exists' } },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(createHsa('ABHA-12345')).rejects.toEqual(error);
    });

    it('should propagate validation error for invalid ABHA ID', async () => {
      const error = {
        response: { status: 422, data: { message: 'Invalid ABHA ID format' } },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(createHsa('invalid')).rejects.toEqual(error);
    });
  });
});
