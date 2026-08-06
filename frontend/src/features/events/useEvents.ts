import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyEvents, createEvent, deleteEvent } from './events.api.js';
import type { CreateEventInput } from './events.schema.js';

export const myEventsKey = ['myEvents'] as const;

export const useMyEvents = () =>
  useQuery({ queryKey: myEventsKey, queryFn: fetchMyEvents });

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEventInput) => createEvent(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: myEventsKey }),
  });
};

export const useDeleteEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: myEventsKey }),
  });
};
