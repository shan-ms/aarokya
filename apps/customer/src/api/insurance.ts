import client from './client';
import {
  ApiResponse,
  InsurancePlan,
  Policy,
  Claim,
  PaginatedResponse,
} from '../types';

interface SubmitClaimData {
  policyId: string;
  /** Amount in paise */
  amount: number;
  description: string;
  hospitalName?: string;
  diagnosisCode?: string;
  documents?: string[];
}

export const getPlans = async (): Promise<ApiResponse<InsurancePlan[]>> => {
  const response = await client.get<ApiResponse<InsurancePlan[]>>('/insurance/plans');
  return response.data;
};

export const subscribe = async (
  planId: string,
): Promise<ApiResponse<Policy>> => {
  const response = await client.post<ApiResponse<Policy>>('/insurance/subscribe', {
    planId,
  });
  return response.data;
};

export const getPolicies = async (): Promise<ApiResponse<Policy[]>> => {
  const response = await client.get<ApiResponse<Policy[]>>('/insurance/policies');
  return response.data;
};

export const submitClaim = async (
  data: SubmitClaimData,
): Promise<ApiResponse<Claim>> => {
  const response = await client.post<ApiResponse<Claim>>('/insurance/claims', data);
  return response.data;
};

export const getClaims = async (): Promise<PaginatedResponse<Claim>> => {
  const response = await client.get<PaginatedResponse<Claim>>('/insurance/claims');
  return response.data;
};
