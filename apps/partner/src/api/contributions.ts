import apiClient from './client';
import {
  ApiResponse,
  PaginatedResponse,
  Contribution,
  BulkContribution,
  ContributionSourceType,
  Report,
} from '../types';

interface CreateContributionPayload {
  workerId: string;
  amountPaise: number;
  sourceType: ContributionSourceType;
}

interface BulkContributePayload {
  workerIds: string[];
  amountPerWorkerPaise: number;
  sourceType: ContributionSourceType;
}

export const createContribution = async (
  partnerId: string,
  payload: CreateContributionPayload,
): Promise<ApiResponse<Contribution>> => {
  const response = await apiClient.post<ApiResponse<Contribution>>(
    `/partners/${partnerId}/contributions`,
    payload,
  );
  return response.data;
};

export const bulkContribute = async (
  partnerId: string,
  payload: BulkContributePayload,
): Promise<ApiResponse<BulkContribution>> => {
  const response = await apiClient.post<ApiResponse<BulkContribution>>(
    `/partners/${partnerId}/contributions/bulk`,
    payload,
  );
  return response.data;
};

export const getContributionHistory = async (
  partnerId: string,
  params?: {
    page?: number;
    pageSize?: number;
    workerId?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<ApiResponse<PaginatedResponse<Contribution>>> => {
  const response = await apiClient.get<ApiResponse<PaginatedResponse<Contribution>>>(
    `/partners/${partnerId}/contributions`,
    { params },
  );
  return response.data;
};

export const getReports = async (
  partnerId: string,
  params?: { startDate?: string; endDate?: string },
): Promise<ApiResponse<Report[]>> => {
  const response = await apiClient.get<ApiResponse<Report[]>>(
    `/partners/${partnerId}/reports`,
    { params },
  );
  return response.data;
};
