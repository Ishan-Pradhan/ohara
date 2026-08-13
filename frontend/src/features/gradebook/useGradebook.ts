import { useQuery } from '@tanstack/react-query';

import { fetchGradebook, fetchMyGrades } from './gradebook.api.js';

export const gradebookKey = (courseId: string, batchId?: string) =>
  ['gradebook', courseId, batchId ?? null] as const;
export const myGradesKey = (courseId: string) => ['myGrades', courseId] as const;

export const useGradebook = (courseId: string, batchId?: string) =>
  useQuery({
    queryKey: gradebookKey(courseId, batchId),
    queryFn: () => fetchGradebook(courseId, batchId),
    enabled: Boolean(courseId),
  });

export const useMyGrades = (courseId: string) =>
  useQuery({
    queryKey: myGradesKey(courseId),
    queryFn: () => fetchMyGrades(courseId),
    enabled: Boolean(courseId),
  });
