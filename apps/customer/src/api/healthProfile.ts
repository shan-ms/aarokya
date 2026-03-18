import client from './client';
import { ApiResponse, HealthProfile } from '../types';

interface UpdateHealthProfileData {
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  height?: number;
  weight?: number;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export const getHealthProfile = async (): Promise<ApiResponse<HealthProfile>> => {
  const response = await client.get<ApiResponse<HealthProfile>>('/health-profile');
  return response.data;
};

export const updateHealthProfile = async (
  data: UpdateHealthProfileData,
): Promise<ApiResponse<HealthProfile>> => {
  const response = await client.put<ApiResponse<HealthProfile>>(
    '/health-profile',
    data,
  );
  return response.data;
};
