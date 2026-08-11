import { useQuery } from '@tanstack/react-query';
import { fetchClassIntelligence } from './classIntelligence.api.js';

export const classIntelligenceKey = (courseId: string) => ['classIntelligence', courseId] as const;

export const useClassIntelligence = (courseId: string) =>
  useQuery({
    queryKey: classIntelligenceKey(courseId),
    queryFn: () => fetchClassIntelligence(courseId),
    enabled: Boolean(courseId),
  });
