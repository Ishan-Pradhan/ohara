import { useQuery } from '@tanstack/react-query';
import { fetchWeeklySummary } from './weeklyIntelligence.api.js';

const weeklyIntelligenceKey = (courseId: string) => ['teacherWeeklyIntelligence', courseId] as const;

export const useWeeklySummary = (courseId: string) =>
  useQuery({
    queryKey: weeklyIntelligenceKey(courseId),
    queryFn: () => fetchWeeklySummary(courseId),
    enabled: Boolean(courseId),
  });
