import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchStudyPlan,
  generateStudyPlan,
  toggleTask,
  deleteTask,
  addTask,
  type AddTaskPayload,
} from './studyPlan.api.js';
import type { StudyPlan } from './studyPlan.schema.js';

export const studyPlanKey = ['studyPlan'] as const;

const setStudyPlan = (qc: ReturnType<typeof useQueryClient>, data: StudyPlan) => {
  qc.setQueryData(studyPlanKey, data);
};

export const useStudyPlan = () =>
  useQuery({
    queryKey: studyPlanKey,
    queryFn: fetchStudyPlan,
  });

export const useGenerateStudyPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: generateStudyPlan,
    onSuccess: (data) => setStudyPlan(qc, data),
  });
};

export const useToggleTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleTask,
    onSuccess: (data) => setStudyPlan(qc, data),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: (data) => setStudyPlan(qc, data),
  });
};

export const useAddTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddTaskPayload) => addTask(payload),
    onSuccess: (data) => setStudyPlan(qc, data),
  });
};
