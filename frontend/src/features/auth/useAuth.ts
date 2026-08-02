import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from './auth.api.js';

/**
 * Session state has exactly one source: this query. No context provider, no
 * store, no duplicated user object anywhere in the app.
 */
export const CURRENT_USER_KEY = ['auth', 'current-user'] as const;

export const useCurrentUser = () =>
  useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: fetchCurrentUser,
    retry: false,
  });

export const useLogin = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: loginRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: CURRENT_USER_KEY }),
  });
};

export const useRegister = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: registerRequest,
    onSuccess: () => qc.invalidateQueries({ queryKey: CURRENT_USER_KEY }),
  });
};

export const useLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => qc.clear(),
  });
};
