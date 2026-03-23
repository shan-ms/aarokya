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

/** Backend returns access_token, refresh_token, user_id, user_type, is_new_user */
interface BackendAuthResponse {
  access_token: string;
  refresh_token: string;
  user_id: string;
  user_type: string;
  is_new_user: boolean;
}

export const sendOtp = async (phone: string): Promise<ApiResponse<SendOtpResponse>> => {
  const response = await client.post('/auth/send-otp', { phone });
  return { data: response.data as SendOtpResponse };
};

export const verifyOtp = async (
  phone: string,
  otp: string,
): Promise<ApiResponse<VerifyOtpResponse>> => {
  const response = await client.post<BackendAuthResponse>('/auth/verify-otp', {
    phone,
    otp,
    user_type: 'customer',
  });
  const data = response.data;
  const user: User = {
    id: data.user_id,
    phone,
    name: '',
    language: 'en',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return {
    data: {
      token: data.access_token,
      refreshToken: data.refresh_token,
      user,
    },
  };
};

export const refreshToken = async (
  token: string,
): Promise<ApiResponse<RefreshTokenResponse>> => {
  const response = await client.post<{ access_token: string }>('/auth/refresh', {
    refresh_token: token,
  });
  return {
    data: {
      token: response.data.access_token,
      refreshToken: token,
    },
  };
};
