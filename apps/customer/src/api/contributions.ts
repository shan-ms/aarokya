import client from './client';
import {
  ApiResponse,
  Contribution,
  ContributionSummary,
  ContributionSource,
  PaginatedResponse,
} from '../types';

interface CreateContributionData {
  /** Amount in paise */
  amount: number;
  source: ContributionSource;
  description?: string;
  paymentMethod?: string;
}

interface ListContributionsParams {
  page?: number;
  pageSize?: number;
  source?: ContributionSource;
  startDate?: string;
  endDate?: string;
}

export const createContribution = async (
  data: CreateContributionData,
): Promise<ApiResponse<Contribution>> => {
  const response = await client.post<ApiResponse<Contribution>>('/contributions', data);
  return response.data;
};

export const listContributions = async (
  params?: ListContributionsParams,
): Promise<PaginatedResponse<Contribution>> => {
  const response = await client.get<PaginatedResponse<Contribution>>('/contributions', {
    params,
  });
  return response.data;
};

export const getContributionSummary = async (): Promise<ApiResponse<ContributionSummary>> => {
  const response = await client.get<ApiResponse<ContributionSummary>>(
    '/contributions/summary',
  );
  return response.data;
};
