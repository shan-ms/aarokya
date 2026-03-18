import client from './client';
import { ApiResponse, User } from '../types';

interface SendOtpResponse {
  requestId: string;
  expiresIn: number;
}

interface VerifyOtpResponse {
  token: string;
  refreshToken: string;
  user: User;
}

interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export const sendOtp = async (phone: string): Promise<ApiResponse<SendOtpResponse>> => {
  const response = await client.post<ApiResponse<SendOtpResponse>>('/auth/otp/send', {
    phone,
  });
  return response.data;
};

export const verifyOtp = async (
  phone: string,
  otp: string,
): Promise<ApiResponse<VerifyOtpResponse>> => {
  const response = await client.post<ApiResponse<VerifyOtpResponse>>('/auth/otp/verify', {
    phone,
    otp,
  });
  return response.data;
};

export const refreshToken = async (
  token: string,
): Promise<ApiResponse<RefreshTokenResponse>> => {
  const response = await client.post<ApiResponse<RefreshTokenResponse>>('/auth/token/refresh', {
    refreshToken: token,
  });
  return response.data;
};
