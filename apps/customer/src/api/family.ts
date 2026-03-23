import client from './client';

export const createFamilyMember = (data: {
  member_name: string;
  relationship: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  emergency_contact?: string;
}) => client.post('/family', data);

export const listFamilyMembers = () =>
  client.get('/family');

export const getFamilyMember = (id: string) =>
  client.get(`/family/${id}`);

export const updateFamilyMember = (id: string, data: Record<string, unknown>) =>
  client.put(`/family/${id}`, data);

export const deleteFamilyMember = (id: string) =>
  client.delete(`/family/${id}`);
