import apiClient from './client';
import { ApiResponse } from '../types';

interface SendOtpResponse {
  requestId: string;
  expiresInSeconds: number;
}

interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  isNewPartner: boolean;
  partnerId?: string;
}

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export const sendOtp = async (phone: string): Promise<ApiResponse<SendOtpResponse>> => {
  const response = await apiClient.post<ApiResponse<SendOtpResponse>>(
    '/auth/partner/send-otp',
    { phone },
  );
  return response.data;
};

export const verifyOtp = async (
  phone: string,
  otp: string,
  requestId: string,
): Promise<ApiResponse<VerifyOtpResponse>> => {
  const response = await apiClient.post<ApiResponse<VerifyOtpResponse>>(
    '/auth/partner/verify-otp',
    { phone, otp, requestId },
  );
  return response.data;
};

export const refreshToken = async (
  token: string,
): Promise<ApiResponse<RefreshTokenResponse>> => {
  const response = await apiClient.post<ApiResponse<RefreshTokenResponse>>(
    '/auth/refresh',
    { refreshToken: token },
  );
  return response.data;
};
