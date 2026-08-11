import { z } from 'zod';
import { api } from '../../lib/axios.js';
import { birthdayPersonSchema, sendWishResponseSchema, type BirthdayPerson, type SendWishResponse } from './birthdays.schema.js';

export const fetchTodayBirthdays = async (): Promise<BirthdayPerson[]> => {
  const res = await api.get('/admin/birthdays/today');
  return z.array(birthdayPersonSchema).parse(res.data.data);
};

export const sendBirthdayWish = async (
  studentIds: string[],
  message: string,
): Promise<SendWishResponse> => {
  const res = await api.post('/admin/birthdays/wish', { studentIds, message });
  return sendWishResponseSchema.parse(res.data.data);
};
