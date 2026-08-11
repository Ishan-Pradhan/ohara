import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyEvents, createEvent, deleteEvent, updateEvent, setDateOfBirth } from './events.api.js';
import type { CreateEventInput, UpdateEventInput } from './events.schema.js';

export const myEventsKey = (from: Date, to: Date) =>
  ['myEvents', from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)] as const;

export const useMyEvents = (from: Date, to: Date) =>
  useQuery({
    queryKey: myEventsKey(from, to),
    queryFn: () => fetchMyEvents(from, to),
  });

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => createEvent(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myEvents'] }),
  });
};

export const useDeleteEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myEvents'] }),
  });
};

export const useUpdateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEventInput }) => updateEvent(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myEvents'] }),
  });
};

export const useSetDateOfBirth = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, dateOfBirth }: { userId: string; dateOfBirth: string }) =>
      setDateOfBirth(userId, dateOfBirth),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['myEvents'] }),
  });
};
