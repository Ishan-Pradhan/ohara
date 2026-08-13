import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const getAtRiskDashboardSchema = {
  params: z.object({ courseId: z.uuid() }),
  // batchId omitted -> the course's current batch (unchanged default).
  // Given -> a specific past batch's at-risk metrics (completed-course
  // history). sectionId stays a separate narrowing filter within a batch.
  query: z.object({ sectionId: z.uuid().optional(), batchId: z.uuid().optional() }),
};

export const explainAtRiskSchema = {
  params: z.object({ courseId: z.uuid(), studentId: z.uuid() }),
  query: z.object({ batchId: z.uuid().optional() }),
};

const atRiskRowSchema = registry.register(
  'AtRiskRow',
  z.object({
    studentId: z.uuid(),
    studentName: z.string(),
    averageGrade: z.number().nullable(),
    attendancePercentage: z.number().nullable(),
    missingSubmissions: z.number(),
    lateSubmissions: z.number(),
    isAtRisk: z.boolean(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/at-risk',
  tags: ['At-Risk Analytics'],
  request: { params: getAtRiskDashboardSchema.params, query: getAtRiskDashboardSchema.query },
  responses: {
    200: {
      description: "FR-40/41: every enrolled student's average grade, attendance %, missing/late submission counts, and whether they cross an at-risk threshold. Optional batchId views a specific past batch's metrics (completed-course history); omitted defaults to the current batch.",
      content: { 'application/json': { schema: envelope(z.array(atRiskRowSchema)) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/at-risk/{studentId}/explain',
  tags: ['At-Risk Analytics'],
  request: { params: explainAtRiskSchema.params, query: explainAtRiskSchema.query },
  responses: {
    200: {
      description: 'FR-42: a short natural-language explanation of why this student was flagged, generated on demand (never automatic)',
      content: { 'application/json': { schema: envelope(z.object({ studentId: z.uuid(), explanation: z.string() })) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Student not enrolled in this course' },
  },
});
