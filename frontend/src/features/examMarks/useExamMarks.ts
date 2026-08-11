import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchExamTerms,
  createExamTerm,
  deleteExamTerm,
  fetchCourseExamMarks,
  upsertCourseExamMarks,
  fetchReportCard,
  fetchBulkExamMarks,
  saveBulkExamMarks,
} from './examMarks.api.js';
import type { CreateExamTermInput, ExamMarkInput } from './examMarks.schema.js';

export const examTermsKey = (academicYearId?: string) => ['examTerms', academicYearId ?? 'all'] as const;

export const useExamTerms = (academicYearId?: string) =>
  useQuery({
    queryKey: examTermsKey(academicYearId),
    queryFn: () => fetchExamTerms(academicYearId),
  });

export const useCreateExamTerm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExamTermInput) => createExamTerm(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['examTerms'] }),
  });
};

export const useDeleteExamTerm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExamTerm(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['examTerms'] }),
  });
};

export const courseExamMarksKey = (courseId: string, examTermId: string) =>
  ['courseExamMarks', courseId, examTermId] as const;

export const useCourseExamMarks = (courseId: string, examTermId: string) =>
  useQuery({
    queryKey: courseExamMarksKey(courseId, examTermId),
    queryFn: () => fetchCourseExamMarks(courseId, examTermId),
    enabled: Boolean(courseId) && Boolean(examTermId),
  });

export const useUpsertCourseExamMarks = (courseId: string, examTermId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (marks: ExamMarkInput[]) => upsertCourseExamMarks(courseId, examTermId, marks),
    onSuccess: () => void qc.invalidateQueries({ queryKey: courseExamMarksKey(courseId, examTermId) }),
  });
};

export const reportCardKey = (studentId: string) => ['reportCard', studentId] as const;

export const useReportCard = (studentId: string) =>
  useQuery({
    queryKey: reportCardKey(studentId),
    queryFn: () => fetchReportCard(studentId),
    enabled: Boolean(studentId),
  });

export const bulkExamMarksKey = (classId: string, batchId: string, examTermId: string, sectionId?: string) =>
  ['bulkExamMarks', classId, batchId, examTermId, sectionId] as const;

export const useBulkExamMarks = (classId: string, batchId: string, examTermId: string, sectionId?: string) =>
  useQuery({
    queryKey: bulkExamMarksKey(classId, batchId, examTermId, sectionId),
    queryFn: () => fetchBulkExamMarks(classId, batchId, examTermId, sectionId),
    enabled: Boolean(classId) && Boolean(batchId) && Boolean(examTermId),
  });

export const useSaveBulkExamMarks = (classId: string, batchId: string, examTermId: string, sectionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      examTermId: string;
      marks: { studentId: string; courseId: string; marksObtained: number; maxMarks: number }[];
    }) => saveBulkExamMarks(variables.examTermId, variables.marks),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bulkExamMarksKey(classId, batchId, examTermId, sectionId) });
      void qc.invalidateQueries({ queryKey: ['reportCard'] });
    },
  });
};
