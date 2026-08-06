import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchAssignments,
  fetchAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  fetchSubmissions,
  fetchMySubmission,
  submitAssignment,
  gradeSubmission,
  gradeAllSubmissions,
  editGrade,
  type EditGradeInput,
} from './assignments.api.js';
import type { CreateAssignmentInput } from './assignments.schema.js';

export const assignmentsKey = (courseId: string) => ['assignments', courseId] as const;
export const assignmentKey = (courseId: string, id: string) => ['assignment', courseId, id] as const;
export const submissionsKey = (courseId: string, assignmentId: string) =>
  ['submissions', courseId, assignmentId] as const;
export const mySubmissionKey = (courseId: string, assignmentId: string) =>
  ['mySubmission', courseId, assignmentId] as const;

export const useAssignments = (courseId: string) =>
  useQuery({
    queryKey: assignmentsKey(courseId),
    queryFn: () => fetchAssignments(courseId),
    enabled: Boolean(courseId),
  });

export const useAssignment = (courseId: string, id: string) =>
  useQuery({
    queryKey: assignmentKey(courseId, id),
    queryFn: () => fetchAssignment(courseId, id),
    enabled: Boolean(courseId) && Boolean(id),
  });

export const useCreateAssignment = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssignmentInput) => createAssignment(courseId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentsKey(courseId) }),
  });
};

export const useUpdateAssignment = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateAssignmentInput> }) =>
      updateAssignment(courseId, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentsKey(courseId) }),
  });
};

export const useDeleteAssignment = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAssignment(courseId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: assignmentsKey(courseId) }),
  });
};

export const useSubmissions = (courseId: string, assignmentId: string) =>
  useQuery({
    queryKey: submissionsKey(courseId, assignmentId),
    queryFn: () => fetchSubmissions(courseId, assignmentId),
    enabled: Boolean(courseId) && Boolean(assignmentId),
  });

export const useMySubmission = (courseId: string, assignmentId: string) =>
  useQuery({
    queryKey: mySubmissionKey(courseId, assignmentId),
    queryFn: () => fetchMySubmission(courseId, assignmentId),
    enabled: Boolean(courseId) && Boolean(assignmentId),
  });

export const useSubmitAssignment = (courseId: string, assignmentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content?: string; file?: File }) =>
      submitAssignment(courseId, assignmentId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: mySubmissionKey(courseId, assignmentId) }),
  });
};

export const useGradeSubmission = (courseId: string, assignmentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) => gradeSubmission(courseId, assignmentId, submissionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: submissionsKey(courseId, assignmentId) }),
  });
};

export const useGradeAllSubmissions = (courseId: string, assignmentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gradeAllSubmissions(courseId, assignmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: submissionsKey(courseId, assignmentId) }),
  });
};

export const useEditGrade = (courseId: string, assignmentId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, input }: { submissionId: string; input: EditGradeInput }) =>
      editGrade(courseId, assignmentId, submissionId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: submissionsKey(courseId, assignmentId) }),
  });
};
