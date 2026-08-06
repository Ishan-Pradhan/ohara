import { registry, z } from './registry.js';

export const getReportCardSchema = {
  params: z.object({ studentId: z.uuid() }),
};

registry.registerPath({
  method: 'get',
  path: '/students/{studentId}/report-card',
  tags: ['Report Cards'],
  request: { params: getReportCardSchema.params },
  responses: {
    200: {
      description: "FR-31: the student's report card/marksheet for their current term — marks across all enrolled courses, computed total/average/letter grade, and attendance %, as a downloadable PDF",
      content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
    },
    401: { description: 'Not authenticated' },
    403: { description: "Not authorized to view this student's report card" },
    404: { description: 'Student not found, or not currently placed' },
  },
});
