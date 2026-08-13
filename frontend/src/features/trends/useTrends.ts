import { useQuery } from '@tanstack/react-query';

import { fetchGradeTrends, fetchAttendanceTrends } from './trends.api.js';

export const gradeTrendsKey = (courseId: string) => ['gradeTrends', courseId] as const;
export const attendanceTrendsKey = (courseId: string, sectionId?: string) =>
  ['attendanceTrends', courseId, sectionId ?? null] as const;

export const useGradeTrends = (courseId: string) =>
  useQuery({
    queryKey: gradeTrendsKey(courseId),
    queryFn: () => fetchGradeTrends(courseId),
    enabled: Boolean(courseId),
  });

/** Omitting sectionId aggregates across every section in whichever academic
 * year is currently relevant for the class — pass it to scope the chart to
 * one specific section instead, same as the summary/sessions views. */
export const useAttendanceTrends = (courseId: string, sectionId?: string) =>
  useQuery({
    queryKey: attendanceTrendsKey(courseId, sectionId),
    queryFn: () => fetchAttendanceTrends(courseId, sectionId),
    enabled: Boolean(courseId),
  });
