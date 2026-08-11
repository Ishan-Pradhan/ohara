import { z } from 'zod';
import { api } from '../../lib/axios.js';
import { eventSchema, type Event, type CreateEventInput, type UpdateEventInput } from './events.schema.js';

export const fetchMyEvents = async (from: Date, to: Date): Promise<Event[]> => {
  const res = await api.get('/events/me', {
    params: { from: from.toISOString(), to: to.toISOString() },
  });
  return z.array(eventSchema).parse(res.data.data);
};

export const createEvent = async (input: CreateEventInput): Promise<Event> => {
  const res = await api.post('/events', input);
  return eventSchema.parse(res.data.data);
};

export const deleteEvent = async (id: string): Promise<void> => {
  await api.delete(`/events/${id}`);
};

export const updateEvent = async (id: string, input: UpdateEventInput): Promise<Event> => {
  const res = await api.patch(`/events/${id}`, input);
  return eventSchema.parse(res.data.data);
};

export const setDateOfBirth = async (userId: string, dateOfBirth: string): Promise<void> => {
  await api.patch(`/admin/users/${userId}/date-of-birth`, { dateOfBirth });
};
