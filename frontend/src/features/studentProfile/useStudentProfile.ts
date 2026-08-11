import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyProfile, updateMyProfile } from './studentProfile.api.js';

export const profileKey = ['studentProfile'] as const;

export const useMyProfile = () =>
  useQuery({
    queryKey: profileKey,
    queryFn: fetchMyProfile,
  });

export const useUpdateMyProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKey }),
  });
};
