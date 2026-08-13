import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import {
  changePassword as changePasswordRequest,
  fetchCurrentUser,
  forgotPassword as forgotPasswordRequest,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  resetPassword as resetPasswordRequest,
} from './auth.api.js';
import type { ChangePasswordInput, ResetPasswordInput } from '../../schemas/auth.schema.js';

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
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logoutRequest,
    // Navigates directly rather than relying on ProtectedRoute reacting to
    // the next current-user refetch failing — immediate, and doesn't depend
    // on some other query re-firing after the cache clears.
    onSuccess: () => {
      qc.clear();
      navigate('/login', { replace: true });
    },
  });
};

export const useForgotPassword = () => useMutation({ mutationFn: forgotPasswordRequest });

export const useResetPassword = (token: string) =>
  useMutation({
    mutationFn: (input: ResetPasswordInput) => resetPasswordRequest(token, input),
  });

export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: ChangePasswordInput) => changePasswordRequest(input),
  });
