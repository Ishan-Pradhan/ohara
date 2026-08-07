import { useQuery } from '@tanstack/react-query';

import { fetchMasteryReport } from './mastery.api.js';

export const masteryReportKey = ['masteryReport'] as const;

export const useMasteryReport = () =>
  useQuery({
    queryKey: masteryReportKey,
    queryFn: fetchMasteryReport,
  });
