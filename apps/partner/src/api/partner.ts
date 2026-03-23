import apiClient from './client';
import {
  ApiResponse,
  Partner,
  PartnerDashboard,
  PartnerType,
  ContributionSchemeType,
} from '../types';

interface RegisterPartnerPayload {
  phone: string;
  businessName: string;
  registrationNumber: string;
  partnerType: PartnerType;
  contributionSchemeType: ContributionSchemeType;
  contributionAmountPaise: number;
}

export const registerPartner = async (
  payload: RegisterPartnerPayload,
): Promise<ApiResponse<Partner>> => {
  const response = await apiClient.post<ApiResponse<Partner>>(
    '/partners',
    payload,
  );
  return response.data;
};

export const getPartner = async (partnerId: string): Promise<ApiResponse<Partner>> => {
  const response = await apiClient.get<ApiResponse<Partner>>(
    `/partners/${partnerId}`,
  );
  return response.data;
};

export const getDashboard = async (
  partnerId: string,
): Promise<ApiResponse<PartnerDashboard>> => {
  const response = await apiClient.get<ApiResponse<PartnerDashboard>>(
    `/partners/${partnerId}/dashboard`,
  );
  return response.data;
};
