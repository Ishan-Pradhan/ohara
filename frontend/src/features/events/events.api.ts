import { z } from 'zod';
import { api } from '../../lib/axios.js';
import { eventSchema, type Event, type CreateEventInput } from './events.schema.js';

export const fetchMyEvents = async (): Promise<Event[]> => {
  const res = await api.get('/events/me');
  return z.array(eventSchema).parse(res.data.data);
};

export const createEvent = async (input: CreateEventInput): Promise<Event> => {
  const res = await api.post('/events', input);
  return eventSchema.parse(res.data.data);
};

export const deleteEvent = async (id: string): Promise<void> => {
  await api.delete(`/events/${id}`);
};
