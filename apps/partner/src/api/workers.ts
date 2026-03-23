import apiClient from './client';
import { ApiResponse, PaginatedResponse, Worker, WorkerWithHsa } from '../types';

interface AddWorkerPayload {
  phone?: string;
  abhaId?: string;
}

export const addWorker = async (
  partnerId: string,
  payload: AddWorkerPayload,
): Promise<ApiResponse<WorkerWithHsa>> => {
  const response = await apiClient.post<ApiResponse<WorkerWithHsa>>(
    `/partners/${partnerId}/workers`,
    payload,
  );
  return response.data;
};

export const listWorkers = async (
  partnerId: string,
  params?: { page?: number; pageSize?: number; search?: string },
): Promise<ApiResponse<PaginatedResponse<WorkerWithHsa>>> => {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<WorkerWithHsa>>>(
    `/partners/${partnerId}/workers`,
    { params },
  );
  return response.data;
};

export const getWorkerDetail = async (
  partnerId: string,
  workerId: string,
): Promise<ApiResponse<WorkerWithHsa>> => {
  const response = await apiClient.get<ApiResponse<WorkerWithHsa>>(
    `/partners/${partnerId}/workers/${workerId}`,
  );
  return response.data;
};

export const searchWorker = async (
  query: string,
): Promise<ApiResponse<Worker | null>> => {
  const response = await apiClient.get<ApiResponse<Worker | null>>(
    '/workers/search',
    { params: { q: query } },
  );
  return response.data;
};
