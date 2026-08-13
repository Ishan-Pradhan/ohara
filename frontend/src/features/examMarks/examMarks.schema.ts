import { z } from 'zod';

export const examTermSchema = z.object({
  id: z.string(),
  name: z.string(),
  academicYearId: z.string(),
  createdAt: z.string(),
});

export const createExamTermSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  academicYearId: z.string().min(1, 'Academic year is required'),
});

export const courseExamMarkRowSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  marksObtained: z.number().nullable(),
  maxMarks: z.number().nullable(),
});

export const examMarkInputSchema = z.object({
  studentId: z.string(),
  marksObtained: z.number().min(0),
  maxMarks: z.number().positive(),
});

export const reportCardExamTermHeaderSchema = z.object({
  examTermId: z.string(),
  examTermName: z.string(),
});

export const reportCardCourseRowSchema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
  marks: z.record(z.string(), z.object({
    marksObtained: z.number(),
    maxMarks: z.number(),
  })),
  courseTotalObtained: z.number(),
  courseTotalMax: z.number(),
  coursePercentage: z.number().nullable(),
});

export const reportCardSemesterSectionSchema = z.object({
  classId: z.string(),
  className: z.string(),
  orderIndex: z.number(),
  batchName: z.string().nullable().optional(),
  sectionName: z.string().nullable().optional(),
  examTerms: z.array(reportCardExamTermHeaderSchema),
  courses: z.array(reportCardCourseRowSchema),
  totalObtained: z.number(),
  totalMax: z.number(),
  percentage: z.number().nullable(),
  grade: z.string(),
});

export const reportCardSchema = z.object({
  studentId: z.string(),
  studentName: z.string(),
  programName: z.string(),
  className: z.string(),
  sectionName: z.string(),
  batchName: z.string(),
  semesters: z.array(reportCardSemesterSectionSchema),
  overallPercentage: z.number().nullable(),
  overallGrade: z.string(),
});

export type ExamTerm = z.infer<typeof examTermSchema>;
export type CreateExamTermInput = z.infer<typeof createExamTermSchema>;
export type CourseExamMarkRow = z.infer<typeof courseExamMarkRowSchema>;
export type ExamMarkInput = z.infer<typeof examMarkInputSchema>;
export type ReportCard = z.infer<typeof reportCardSchema>;
export type ReportCardSemesterSection = z.infer<typeof reportCardSemesterSectionSchema>;
