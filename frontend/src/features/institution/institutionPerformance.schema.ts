import { z } from 'zod';

export const institutionPerformanceInsightsSchema = z.object({
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
  courseId: z.string(),
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
  insights: institutionPerformanceInsightsSchema.nullable(),
  insightsGeneratedAt: z.string().nullable(),
});

export const generatedInstitutionPerformanceInsightsSchema = z.object({
  insights: institutionPerformanceInsightsSchema,
  generatedAt: z.string(),
});

export type InstitutionPerformance = z.infer<typeof institutionPerformanceSchema>;
export type InstitutionPerformanceInsights = z.infer<typeof institutionPerformanceInsightsSchema>;
export type ProgramSummary = z.infer<typeof programSummarySchema>;
export type CourseSummary = z.infer<typeof courseSummarySchema>;
