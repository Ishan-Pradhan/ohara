import { z } from 'zod';

const insightsSchema = z.object({
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

const programSummarySchema = z.object({
  name: z.string(),
  courseCount: z.number(),
  studentCount: z.number(),
  averageGrade: z.number().nullable(),
  attendanceRate: z.number().nullable(),
  atRiskCount: z.number(),
});

const courseSummarySchema = z.object({
  name: z.string(),
  averageGrade: z.number().nullable(),
  enrollmentCount: z.number(),
});

export const institutionPerformanceSchema = z.object({
  totals: z.object({
    programs: z.number(),
    classes: z.number(),
    courses: z.number(),
    students: z.number(),
    teachers: z.number(),
    activeEnrollments: z.number(),
  }),
  academic: z.object({
    overallAverageGrade: z.number().nullable(),
    overallAttendanceRate: z.number().nullable(),
    totalAtRisk: z.number(),
    atRiskRate: z.number().nullable(),
    totalSubmissions: z.number(),
    totalMissingSubmissions: z.number(),
  }),
  programs: z.array(programSummarySchema),
  topCourses: z.array(courseSummarySchema),
  bottomCourses: z.array(courseSummarySchema),
  insights: insightsSchema.nullable(),
});

export type InstitutionPerformance = z.infer<typeof institutionPerformanceSchema>;
