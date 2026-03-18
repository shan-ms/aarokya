/**
 * ART: Auth API Tests
 *
 * Tests auth API calls (sendOtp, verifyOtp, refreshToken)
 * with mocked axios client.
 */

import client from '../../api/client';
import { sendOtp, verifyOtp, refreshToken } from '../../api/auth';

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

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOtp', () => {
    it('should POST to /auth/otp/send with phone number', async () => {
      const mockResponse = {
        data: {
          data: {
            requestId: 'req-001',
            expiresIn: 300,
          },
        },
      };

      (mockedClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await sendOtp('+919876543210');

      expect(mockedClient.post).toHaveBeenCalledWith('/auth/otp/send', {
        phone: '+919876543210',
      });
      expect(result.data.requestId).toBe('req-001');
      expect(result.data.expiresIn).toBe(300);
    });

    it('should propagate network errors', async () => {
      (mockedClient.post as jest.Mock).mockRejectedValue(
        new Error('Network Error'),
      );

      await expect(sendOtp('+919876543210')).rejects.toThrow('Network Error');
    });

    it('should propagate server error responses', async () => {
      const error = {
        response: {
          status: 429,
          data: { message: 'Too many OTP requests' },
        },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(sendOtp('+919876543210')).rejects.toEqual(error);
    });
  });

  describe('verifyOtp', () => {
    it('should POST to /auth/otp/verify with phone and otp', async () => {
      const mockResponse = {
        data: {
          data: {
            token: 'access-token-123',
            refreshToken: 'refresh-token-456',
            user: {
              id: 'user-001',
              phone: '+919876543210',
              name: 'Ramesh',
              language: 'hi',
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      };

      (mockedClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifyOtp('+919876543210', '123456');

      expect(mockedClient.post).toHaveBeenCalledWith('/auth/otp/verify', {
        phone: '+919876543210',
        otp: '123456',
      });
      expect(result.data.token).toBe('access-token-123');
      expect(result.data.refreshToken).toBe('refresh-token-456');
      expect(result.data.user.id).toBe('user-001');
    });

    it('should propagate invalid OTP error', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid OTP' },
        },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(verifyOtp('+919876543210', '000000')).rejects.toEqual(error);
    });

    it('should propagate expired OTP error', async () => {
      const error = {
        response: {
          status: 410,
          data: { message: 'OTP expired' },
        },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(verifyOtp('+919876543210', '123456')).rejects.toEqual(error);
    });
  });

  describe('refreshToken', () => {
    it('should POST to /auth/token/refresh with refresh token', async () => {
      const mockResponse = {
        data: {
          data: {
            token: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      };

      (mockedClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await refreshToken('old-refresh-token');

      expect(mockedClient.post).toHaveBeenCalledWith('/auth/token/refresh', {
        refreshToken: 'old-refresh-token',
      });
      expect(result.data.token).toBe('new-access-token');
      expect(result.data.refreshToken).toBe('new-refresh-token');
    });

    it('should propagate error when refresh token is invalid', async () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid refresh token' },
        },
      };
      (mockedClient.post as jest.Mock).mockRejectedValue(error);

      await expect(refreshToken('expired-token')).rejects.toEqual(error);
    });
  });
});
