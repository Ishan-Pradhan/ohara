import { useMutation } from '@tanstack/react-query';
import { generateLessonPlan } from './lessonPlanner.api.js';

export const useGenerateLessonPlan = (courseId: string) =>
  useMutation({
    mutationFn: ({ topic, durationMinutes }: { topic: string; durationMinutes: number }) =>
      generateLessonPlan(courseId, topic, durationMinutes),
  });
