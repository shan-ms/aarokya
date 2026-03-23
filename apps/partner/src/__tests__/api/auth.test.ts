/**
 * ART: Auth API Tests
 *
 * Tests authentication API calls: sendOtp, verifyOtp, refreshToken.
 * All API calls are tested via mocked axios.
 */

import apiClient from '../../api/client';
import { sendOtp, verifyOtp, refreshToken } from '../../api/auth';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  setAuthCallbacks: jest.fn(),
}));

const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOtp', () => {
    it('should POST to /auth/partner/send-otp with phone', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            requestId: 'req-123',
            expiresInSeconds: 120,
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await sendOtp('+919876543210');

      expect(mockedPost).toHaveBeenCalledWith('/auth/partner/send-otp', {
        phone: '+919876543210',
      });
      expect(result.data.requestId).toBe('req-123');
      expect(result.data.expiresInSeconds).toBe(120);
    });

    it('should propagate error on invalid phone', async () => {
      mockedPost.mockRejectedValue(new Error('Invalid phone number'));

      await expect(sendOtp('invalid')).rejects.toThrow('Invalid phone number');
    });

    it('should propagate network errors', async () => {
      mockedPost.mockRejectedValue(new Error('Network Error'));

      await expect(sendOtp('+919876543210')).rejects.toThrow('Network Error');
    });
  });

  describe('verifyOtp', () => {
    it('should POST to /auth/partner/verify-otp with phone, otp, requestId', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            accessToken: 'access-token-xyz',
            refreshToken: 'refresh-token-xyz',
            isNewPartner: false,
            partnerId: 'partner-001',
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await verifyOtp('+919876543210', '123456', 'req-123');

      expect(mockedPost).toHaveBeenCalledWith('/auth/partner/verify-otp', {
        phone: '+919876543210',
        otp: '123456',
        requestId: 'req-123',
      });
      expect(result.data.accessToken).toBe('access-token-xyz');
      expect(result.data.isNewPartner).toBe(false);
      expect(result.data.partnerId).toBe('partner-001');
    });

    it('should handle new partner response (no partnerId)', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            accessToken: 'token-new',
            refreshToken: 'refresh-new',
            isNewPartner: true,
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await verifyOtp('+919876543210', '123456', 'req-456');

      expect(result.data.isNewPartner).toBe(true);
      expect(result.data.partnerId).toBeUndefined();
    });

    it('should propagate error on wrong OTP', async () => {
      mockedPost.mockRejectedValue(new Error('Invalid OTP'));

      await expect(verifyOtp('+919876543210', '000000', 'req-123')).rejects.toThrow(
        'Invalid OTP',
      );
    });

    it('should propagate error on expired OTP', async () => {
      mockedPost.mockRejectedValue(new Error('OTP expired'));

      await expect(verifyOtp('+919876543210', '123456', 'req-old')).rejects.toThrow(
        'OTP expired',
      );
    });
  });

  describe('refreshToken', () => {
    it('should POST to /auth/refresh with refresh token', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await refreshToken('old-refresh-token');

      expect(mockedPost).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'old-refresh-token',
      });
      expect(result.data.accessToken).toBe('new-access-token');
      expect(result.data.refreshToken).toBe('new-refresh-token');
    });

    it('should propagate error when refresh token is invalid', async () => {
      mockedPost.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(refreshToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });
});
