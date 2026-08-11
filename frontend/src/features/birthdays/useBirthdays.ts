import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTodayBirthdays, sendBirthdayWish } from './birthdays.api.js';

export const todayBirthdaysKey = ['todayBirthdays'] as const;

export const useTodayBirthdays = () =>
  useQuery({
    queryKey: todayBirthdaysKey,
    queryFn: fetchTodayBirthdays,
  });

export const useSendBirthdayWish = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ studentIds, message }: { studentIds: string[]; message: string }) =>
      sendBirthdayWish(studentIds, message),
    onSuccess: () => qc.invalidateQueries({ queryKey: todayBirthdaysKey }),
  });
};
