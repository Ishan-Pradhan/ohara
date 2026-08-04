import { useMutation, useQueryClient } from '@tanstack/react-query';

import { admitStudent } from './admission.api.js';
import type { AdmitStudentInput } from './admission.schema.js';

export const useAdmitStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdmitStudentInput) => admitStudent(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
};
