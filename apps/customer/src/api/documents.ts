import client from './client';

export const createDocument = (data: {
  document_type: string;
  title: string;
  description?: string;
  file_url?: string;
  tags?: string[];
  family_member_id?: string;
}) => client.post('/documents', data);

export const listDocuments = () =>
  client.get('/documents');

export const getDocument = (id: string) =>
  client.get(`/documents/${id}`);

export const deleteDocument = (id: string) =>
  client.delete(`/documents/${id}`);

export const shareDocument = (data: {
  document_id: string;
  shared_with: string;
  purpose?: string;
  expires_in_hours?: number;
}) => client.post('/documents/share', data);

export const listShared = () =>
  client.get('/documents/shared');
