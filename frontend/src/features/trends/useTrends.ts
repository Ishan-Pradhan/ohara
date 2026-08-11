import { useQuery } from '@tanstack/react-query';

import { fetchGradeTrends, fetchAttendanceTrends } from './trends.api.js';

export const gradeTrendsKey = (courseId: string) => ['gradeTrends', courseId] as const;
export const attendanceTrendsKey = (courseId: string) => ['attendanceTrends', courseId] as const;

export const useGradeTrends = (courseId: string) =>
  useQuery({
    queryKey: gradeTrendsKey(courseId),
    queryFn: () => fetchGradeTrends(courseId),
    enabled: Boolean(courseId),
  });

export const useAttendanceTrends = (courseId: string) =>
  useQuery({
    queryKey: attendanceTrendsKey(courseId),
    queryFn: () => fetchAttendanceTrends(courseId),
    enabled: Boolean(courseId),
  });
