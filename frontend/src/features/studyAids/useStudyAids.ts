import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchSummary,
  generateSummary,
  fetchFlashcards,
  generateFlashcards,
  explainConcept,
} from './studyAids.api.js';

const scopeKey = (lessonId?: string) => lessonId ?? 'course';

export const summaryKey = (courseId: string, lessonId?: string) =>
  ['studyAids', 'summary', courseId, scopeKey(lessonId)] as const;

export const useSummary = (courseId: string, lessonId?: string) =>
  useQuery({
    queryKey: summaryKey(courseId, lessonId),
    queryFn: () => fetchSummary(courseId, lessonId),
    enabled: Boolean(courseId),
  });

export const useGenerateSummary = (courseId: string, lessonId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (regenerate?: boolean) => generateSummary(courseId, lessonId, regenerate),
    onSuccess: (data) => qc.setQueryData(summaryKey(courseId, lessonId), data),
  });
};

export const flashcardsKey = (courseId: string, lessonId?: string) =>
  ['studyAids', 'flashcards', courseId, scopeKey(lessonId)] as const;

export const useFlashcards = (courseId: string, lessonId?: string) =>
  useQuery({
    queryKey: flashcardsKey(courseId, lessonId),
    queryFn: () => fetchFlashcards(courseId, lessonId),
    enabled: Boolean(courseId),
  });

export const useGenerateFlashcards = (courseId: string, lessonId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (regenerate?: boolean) => generateFlashcards(courseId, lessonId, regenerate),
    onSuccess: (data) => qc.setQueryData(flashcardsKey(courseId, lessonId), data),
  });
};

export const useExplainConcept = (courseId: string, lessonId?: string) =>
  useMutation({
    mutationFn: (topic: string) => explainConcept(courseId, { lessonId, topic }),
  });
