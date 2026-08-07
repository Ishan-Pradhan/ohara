import { useQuery } from '@tanstack/react-query';

import { fetchLearningProfile } from './learningProfile.api.js';

export const learningProfileKey = ['learningProfile'] as const;

export const useLearningProfile = () =>
  useQuery({
    queryKey: learningProfileKey,
    queryFn: fetchLearningProfile,
  });
