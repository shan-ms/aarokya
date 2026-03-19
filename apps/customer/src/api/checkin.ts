import client from './client';
import { Symptom } from '../types';

export const createCheckin = (symptoms: Symptom[], familyMemberId?: string, additionalNotes?: string) =>
  client.post('/checkin', { symptoms, family_member_id: familyMemberId, additional_notes: additionalNotes });

export const listCheckins = () =>
  client.get('/checkin');
