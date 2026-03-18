import client from './client';
import { ApiResponse, HSA, Dashboard } from '../types';

export const getHsa = async (): Promise<ApiResponse<HSA>> => {
  const response = await client.get<ApiResponse<HSA>>('/hsa');
  return response.data;
};

export const getDashboard = async (): Promise<ApiResponse<Dashboard>> => {
  const response = await client.get<ApiResponse<Dashboard>>('/hsa/dashboard');
  return response.data;
};

export const createHsa = async (abhaId: string): Promise<ApiResponse<HSA>> => {
  const response = await client.post<ApiResponse<HSA>>('/hsa', { abhaId });
  return response.data;
};
