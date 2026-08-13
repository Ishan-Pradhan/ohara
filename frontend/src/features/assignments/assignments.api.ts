import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  assignmentSchema,
  submissionSchema,
  gradeSchema,
  type Assignment,
  type CreateAssignmentInput,
  type Submission,
  type Grade,
} from './assignments.schema.js';

// batchId omitted -> the course's current batch. Given -> a specific past
// batch's assignments (viewing completed-course history).
export const fetchAssignments = async (courseId: string, batchId?: string): Promise<Assignment[]> => {
  const res = await api.get(`/courses/${courseId}/assignments`, { params: batchId ? { batchId } : undefined });
  return z.array(assignmentSchema).parse(res.data.data);
};

export const fetchAssignment = async (courseId: string, id: string): Promise<Assignment> => {
  const res = await api.get(`/courses/${courseId}/assignments/${id}`);
  return assignmentSchema.parse(res.data.data);
};

export const createAssignment = async (
  courseId: string,
  input: CreateAssignmentInput,
): Promise<Assignment> => {
  const res = await api.post(`/courses/${courseId}/assignments`, input);
  return assignmentSchema.parse(res.data.data);
};

export const updateAssignment = async (
  courseId: string,
  id: string,
  input: Partial<CreateAssignmentInput>,
): Promise<Assignment> => {
  const res = await api.patch(`/courses/${courseId}/assignments/${id}`, input);
  return assignmentSchema.parse(res.data.data);
};

export const deleteAssignment = async (courseId: string, id: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/assignments/${id}`);
};

export const fetchSubmissions = async (
  courseId: string,
  assignmentId: string,
): Promise<Submission[]> => {
  const res = await api.get(`/courses/${courseId}/assignments/${assignmentId}/submissions`);
  return z.array(submissionSchema).parse(res.data.data);
};

export const fetchMySubmission = async (
  courseId: string,
  assignmentId: string,
): Promise<Submission | null> => {
  const res = await api.get(`/courses/${courseId}/assignments/${assignmentId}/submissions/me`);
  return submissionSchema.nullable().parse(res.data.data);
};

export const submitAssignment = async (
  courseId: string,
  assignmentId: string,
  input: { content?: string; file?: File },
): Promise<Submission> => {
  const formData = new FormData();
  if (input.content) formData.append('content', input.content);
  if (input.file) formData.append('file', input.file);

  const res = await api.post(
    `/courses/${courseId}/assignments/${assignmentId}/submissions`,
    formData,
    // Overrides the instance's default application/json header so the
    // browser sets multipart/form-data with the correct boundary itself.
    { headers: { 'Content-Type': undefined } },
  );
  return submissionSchema.parse(res.data.data);
};

export const gradeSubmission = async (
  courseId: string,
  assignmentId: string,
  submissionId: string,
): Promise<Grade> => {
  const res = await api.post(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/grade`,
  );
  return gradeSchema.parse(res.data.data);
};

export interface GradeAllResult {
  total: number;
  graded: number;
  failed: number;
  errors: { submissionId: string; error: string }[];
}

export const gradeAllSubmissions = async (
  courseId: string,
  assignmentId: string,
): Promise<GradeAllResult> => {
  const res = await api.post(`/courses/${courseId}/assignments/${assignmentId}/grade-all`);
  return res.data.data as GradeAllResult;
};

export interface EditGradeInput {
  criterionFeedback: { criterion: string; maxPoints: number; awardedPoints: number; feedback: string }[];
  overallFeedback?: string | null;
  status?: 'draft' | 'approved';
}

export const editGrade = async (
  courseId: string,
  assignmentId: string,
  submissionId: string,
  input: EditGradeInput,
): Promise<Grade> => {
  const res = await api.patch(
    `/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/grade`,
    input,
  );
  return gradeSchema.parse(res.data.data);
};
