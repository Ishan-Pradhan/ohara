import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/axios.js';
import {
  createStaff,
  fetchTeachers,
  fetchUsers,
  inviteUsersBatch,
  type FetchUsersParams,
} from './users.api.js';

export const TEACHERS_KEY = ['users', 'teachers'] as const;
export const usersKey = (params: FetchUsersParams) => ['users', 'list', params] as const;

export const useTeachers = () => useQuery({ queryKey: TEACHERS_KEY, queryFn: fetchTeachers });

export const useUsers = (params: FetchUsersParams) =>
  useQuery({ queryKey: usersKey(params), queryFn: () => fetchUsers(params) });

export const useArchiveUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/archive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useCreateStaff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStaff,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useInviteUsersBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inviteUsersBatch,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useHardDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`, { data: { confirmHardDelete: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};
