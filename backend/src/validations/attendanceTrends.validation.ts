import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller does not have access to this course' };

export const getAttendanceTrendsSchema = {
  params: z.object({ courseId: z.uuid() }),
  query: z.object({ sectionId: z.uuid().optional() }),
};

const attendanceTrendPointSchema = z.object({
  date: z.string(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  total: z.number(),
});

export const attendanceTrendsSchema = registry.register(
  'AttendanceTrends',
  z.array(attendanceTrendPointSchema),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/attendance-trends',
  tags: ['Attendance Trends'],
  request: { params: getAttendanceTrendsSchema.params, query: getAttendanceTrendsSchema.query },
  responses: {
    200: {
      description:
        'Per-session attendance counts ordered by date for trend charting. Pass ?sectionId= to ' +
        'scope to one section; omitted, this aggregates across every section in whichever academic ' +
        'year is currently relevant for the class.',
      content: { 'application/json': { schema: envelope(attendanceTrendsSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
  },
});
