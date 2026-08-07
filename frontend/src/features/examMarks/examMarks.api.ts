import { z } from 'zod';
import { api } from '../../lib/axios.js';
import {
  examTermSchema,
  courseExamMarkRowSchema,
  reportCardSchema,
  type ExamTerm,
  type CreateExamTermInput,
  type CourseExamMarkRow,
  type ExamMarkInput,
  type ReportCard,
} from './examMarks.schema.js';

export const fetchExamTerms = async (academicYearId?: string): Promise<ExamTerm[]> => {
  const res = await api.get('/exam-terms', { params: academicYearId ? { academicYearId } : undefined });
  return z.array(examTermSchema).parse(res.data.data);
};

export const createExamTerm = async (input: CreateExamTermInput): Promise<ExamTerm> => {
  const res = await api.post('/exam-terms', input);
  return examTermSchema.parse(res.data.data);
};

export const deleteExamTerm = async (id: string): Promise<void> => {
  await api.delete(`/exam-terms/${id}`);
};

export const fetchCourseExamMarks = async (
  courseId: string,
  examTermId: string,
): Promise<CourseExamMarkRow[]> => {
  const res = await api.get(`/courses/${courseId}/exam-marks/${examTermId}`);
  return z.array(courseExamMarkRowSchema).parse(res.data.data);
};

export const upsertCourseExamMarks = async (
  courseId: string,
  examTermId: string,
  marks: ExamMarkInput[],
): Promise<CourseExamMarkRow[]> => {
  const res = await api.put(`/courses/${courseId}/exam-marks/${examTermId}`, { marks });
  return z.array(courseExamMarkRowSchema).parse(res.data.data);
};

export const fetchReportCard = async (studentId: string): Promise<ReportCard> => {
  const res = await api.get(`/students/${studentId}/transcript`);
  return reportCardSchema.parse(res.data.data);
};

export interface BulkExamMarksData {
  students: { id: string; name: string }[];
  courses: { id: string; title: string }[];
  marks: { studentId: string; courseId: string; marksObtained: number; maxMarks: number }[];
}

export const fetchBulkExamMarks = async (
  classId: string,
  batchId: string,
  examTermId: string,
): Promise<BulkExamMarksData> => {
  const res = await api.get('/courses/exam-marks/bulk', {
    params: { classId, batchId, examTermId },
  });
  return res.data.data;
};

export const saveBulkExamMarks = async (
  examTermId: string,
  marks: { studentId: string; courseId: string; marksObtained: number; maxMarks: number }[],
): Promise<void> => {
  await api.put('/courses/exam-marks/bulk', { examTermId, marks });
};
