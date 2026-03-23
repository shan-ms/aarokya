/**
 * ART: Insurance API Tests
 *
 * Tests insurance API calls (getPlans, subscribe, getPolicies,
 * submitClaim, getClaims) with mocked axios client.
 */

import client from '../../api/client';
import {
  getPlans,
  subscribe,
  getPolicies,
  submitClaim,
  getClaims,
} from '../../api/insurance';

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

describe('Insurance API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlans', () => {
    it('should GET /insurance/plans and return list of plans', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'plan-basic',
              name: 'Aarokya Basic',
              type: 'basic',
              premium: 199900, // 1,999.00 INR
              coverageAmount: 10000000, // 1,00,000.00 INR
              minHsaBalance: 399900, // 3,999.00 INR
              features: ['OPD Coverage', 'Telemedicine'],
              description: 'Basic health insurance',
              active: true,
            },
            {
              id: 'plan-premium',
              name: 'Aarokya Premium',
              type: 'premium',
              premium: 499900,
              coverageAmount: 50000000,
              minHsaBalance: 1000000,
              features: ['Full Coverage', 'Cashless', 'Dental'],
              description: 'Premium plan',
              active: true,
            },
          ],
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getPlans();

      expect(mockedClient.get).toHaveBeenCalledWith('/insurance/plans');
      expect(result.data).toHaveLength(2);
      expect(result.data[0].premium).toBe(199900);
      expect(result.data[1].type).toBe('premium');
    });

    it('should return empty list when no plans available', async () => {
      const mockResponse = { data: { data: [] } };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getPlans();
      expect(result.data).toEqual([]);
    });

    it('should propagate errors', async () => {
      (mockedClient.get as jest.Mock).mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(getPlans()).rejects.toThrow('Service unavailable');
    });
  });

  describe('subscribe', () => {
    it('should POST to /insurance/subscribe with plan ID', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'policy-001',
            userId: 'user-001',
            planId: 'plan-basic',
            plan: {
              id: 'plan-basic',
              name: 'Aarokya Basic',
              type: 'basic',
              premium: 199900,
              coverageAmount: 10000000,
              minHsaBalance: 399900,
              features: [],
              description: '',
              active: true,
            },
            status: 'active',
            startDate: '2025-03-01',
            endDate: '2026-03-01',
            premiumPaid: 199900,
            policyNumber: 'POL-2025-001',
            createdAt: '2025-03-01T00:00:00Z',
          },
        },
      };

      (mockedClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await subscribe('plan-basic');

      expect(mockedClient.post).toHaveBeenCalledWith('/insurance/subscribe', {
        planId: 'plan-basic',
      });
      expect(result.data.status).toBe('active');
      expect(result.data.premiumPaid).toBe(199900);
    });

    it('should propagate error when HSA balance insufficient', async () => {
      const error = {
        response: {
          status: 422,
          data: {
            message: 'HSA balance below minimum threshold of 399900 paise',
          },
        },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(subscribe('plan-basic')).rejects.toEqual(error);
    });

    it('should propagate error for invalid plan', async () => {
      const error = {
        response: { status: 404, data: { message: 'Plan not found' } },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(subscribe('nonexistent')).rejects.toEqual(error);
    });
  });

  describe('getPolicies', () => {
    it('should GET /insurance/policies and return user policies', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'policy-001',
              userId: 'user-001',
              planId: 'plan-basic',
              plan: {
                id: 'plan-basic',
                name: 'Aarokya Basic',
                type: 'basic',
                premium: 199900,
                coverageAmount: 10000000,
                minHsaBalance: 399900,
                features: [],
                description: '',
                active: true,
              },
              status: 'active',
              startDate: '2025-01-01',
              endDate: '2026-01-01',
              premiumPaid: 199900,
              policyNumber: 'POL-2025-001',
              createdAt: '2025-01-01T00:00:00Z',
            },
          ],
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getPolicies();

      expect(mockedClient.get).toHaveBeenCalledWith('/insurance/policies');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].policyNumber).toBe('POL-2025-001');
    });

    it('should return empty array for user with no policies', async () => {
      const mockResponse = { data: { data: [] } };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getPolicies();
      expect(result.data).toEqual([]);
    });
  });

  describe('submitClaim', () => {
    it('should POST to /insurance/claims with claim data (amount in paise)', async () => {
      const claimData = {
        policyId: 'policy-001',
        amount: 2500000, // 25,000.00 INR
        description: 'Hospital visit for fever',
        hospitalName: 'Apollo Clinic',
        diagnosisCode: 'J11',
        documents: ['doc-001', 'doc-002'],
      };

      const mockResponse = {
        data: {
          data: {
            id: 'claim-001',
            policyId: 'policy-001',
            amount: 2500000,
            status: 'submitted',
            description: 'Hospital visit for fever',
            hospitalName: 'Apollo Clinic',
            diagnosisCode: 'J11',
            documents: ['doc-001', 'doc-002'],
            submittedAt: '2025-03-15T12:00:00Z',
          },
        },
      };

      (mockedClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await submitClaim(claimData);

      expect(mockedClient.post).toHaveBeenCalledWith(
        '/insurance/claims',
        claimData,
      );
      expect(result.data.status).toBe('submitted');
      expect(result.data.amount).toBe(2500000);
    });

    it('should propagate error for invalid policy', async () => {
      const error = {
        response: { status: 404, data: { message: 'Policy not found' } },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        submitClaim({
          policyId: 'invalid',
          amount: 100000,
          description: 'test',
        }),
      ).rejects.toEqual(error);
    });

    it('should propagate error for claim exceeding coverage', async () => {
      const error = {
        response: {
          status: 422,
          data: { message: 'Claim amount exceeds coverage limit' },
        },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        submitClaim({
          policyId: 'policy-001',
          amount: 999999999,
          description: 'Big claim',
        }),
      ).rejects.toEqual(error);
    });
  });

  describe('getClaims', () => {
    it('should GET /insurance/claims and return paginated claims', async () => {
      const mockResponse = {
        data: {
          data: [
            {
              id: 'claim-001',
              policyId: 'policy-001',
              amount: 2500000,
              status: 'approved',
              description: 'Hospital visit',
              documents: [],
              submittedAt: '2025-03-01T00:00:00Z',
              resolvedAt: '2025-03-10T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
          hasMore: false,
        },
      };

      (mockedClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getClaims();

      expect(mockedClient.get).toHaveBeenCalledWith('/insurance/claims');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('approved');
    });

    it('should return empty list when no claims', async () => {
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

      const result = await getClaims();
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
