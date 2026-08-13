import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/axios.js';
import {
  createStaff,
  fetchStaffCourses,
  fetchTeachers,
  fetchUserById,
  fetchUsers,
  inviteUsersBatch,
  type FetchUsersParams,
} from './users.api.js';

export const TEACHERS_KEY = ['users', 'teachers'] as const;
export const usersKey = (params: FetchUsersParams) => ['users', 'list', params] as const;
export const userKey = (id: string) => ['users', 'detail', id] as const;
export const staffCoursesKey = (id: string) => ['users', 'detail', id, 'courses'] as const;

export const useTeachers = () => useQuery({ queryKey: TEACHERS_KEY, queryFn: fetchTeachers });

export const useUsers = (params: FetchUsersParams) =>
  useQuery({ queryKey: usersKey(params), queryFn: () => fetchUsers(params) });

/** Staff detail page — works for any role (teacher or admin). */
export const useUser = (id: string) =>
  useQuery({ queryKey: userKey(id), queryFn: () => fetchUserById(id), enabled: Boolean(id) });

export const useStaffCourses = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: staffCoursesKey(id),
    queryFn: () => fetchStaffCourses(id),
    enabled: enabled && Boolean(id),
  });

export const useArchiveUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/archive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};

export const useRestoreUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/restore`),
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

/** Role-agnostic (unlike archive/restore/hard-delete, which are
 * student-only) — the access-revocation path for staff accounts. */
export const useToggleBlockUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/admin/toggle-block/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};
