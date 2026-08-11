import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const getClassIntelligenceSchema = {
  params: z.object({ courseId: z.uuid() }),
};

const performerSchema = z.object({
  studentId: z.uuid(),
  studentName: z.string(),
  average: z.number(),
});

const classIntelligenceSchema = registry.register(
  'ClassIntelligence',
  z.object({
    courseId: z.uuid(),
    enrollmentCount: z.number(),
    activeStudents: z.number(),
    classAverage: z.number().nullable(),
    attendanceRate: z.number().nullable(),
    submissionCompletionRate: z.number().nullable(),
    atRiskCount: z.number(),
    topPerformers: z.array(performerSchema),
    bottomPerformers: z.array(performerSchema),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/class-intelligence',
  tags: ['Teacher Intelligence'],
  request: { params: getClassIntelligenceSchema.params },
  responses: {
    200: {
      description: 'Class intelligence summary: averages, attendance, submission rate, at-risk count, top/bottom performers',
      content: { 'application/json': { schema: envelope(classIntelligenceSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});
