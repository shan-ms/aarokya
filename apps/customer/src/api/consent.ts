import client from './client';

export const grantConsent = (purpose: string, scope?: string) =>
  client.post('/consent', { purpose, scope });

export const listConsents = () =>
  client.get('/consent');

export const withdrawConsent = (purpose: string) =>
  client.post('/consent/withdraw', { purpose });

export const exportUserData = () =>
  client.get('/consent/export');

export const deleteAccount = () =>
  client.delete('/consent/delete-account');
