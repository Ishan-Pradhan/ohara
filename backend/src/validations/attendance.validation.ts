import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const studentOnly = { description: 'Caller is not a student enrolled in this course' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

const attendanceRecordInputSchema = z.object({
  studentId: z.uuid(),
  status: z.enum(['present', 'absent', 'late']),
});

export const createAttendanceSessionSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({
    sessionDate: z.iso.date(),
    records: z.array(attendanceRecordInputSchema).min(1),
  }),
};

export const listAttendanceSessionsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const getAttendanceSessionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const updateAttendanceSessionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({ records: z.array(attendanceRecordInputSchema).min(1) }),
};

export const deleteAttendanceSessionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const getAttendanceSummarySchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const getMyAttendanceSchema = {
  params: z.object({ courseId: z.uuid() }),
};

// ── Response schemas ─────────────────────────────────────────────────────────

const attendanceRecordSchema = z.object({
  studentId: z.uuid(),
  studentName: z.string(),
  status: z.enum(['present', 'absent', 'late']),
});

const attendanceSessionSchema = registry.register(
  'AttendanceSession',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    sessionDate: z.iso.date(),
    records: z.array(attendanceRecordSchema),
  }),
);

const attendanceSessionSummarySchema = registry.register(
  'AttendanceSessionSummary',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    sessionDate: z.iso.date(),
  }),
);

const attendancePercentageSchema = z.object({
  total: z.number(),
  present: z.number(),
  absent: z.number(),
  late: z.number(),
  percentage: z.number().nullable(),
});

const attendanceSummaryRowSchema = registry.register(
  'AttendanceSummaryRow',
  z.object({ studentId: z.uuid(), studentName: z.string() }).extend(attendancePercentageSchema.shape),
);

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/attendance/sessions',
  tags: ['Attendance'],
  request: {
    params: createAttendanceSessionSchema.params,
    body: { content: { 'application/json': { schema: createAttendanceSessionSchema.body } } },
  },
  responses: {
    201: {
      description: 'Attendance session recorded for the given date',
      content: { 'application/json': { schema: envelope(attendanceSessionSchema) } },
    },
    400: { description: 'A record references a student not actively enrolled in this course' },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/attendance/sessions',
  tags: ['Attendance'],
  request: { params: listAttendanceSessionsSchema.params },
  responses: {
    200: {
      description: 'Every attendance session taken for this course, newest first',
      content: { 'application/json': { schema: envelope(z.array(attendanceSessionSummarySchema)) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/attendance/sessions/{id}',
  tags: ['Attendance'],
  request: { params: getAttendanceSessionSchema.params },
  responses: {
    200: {
      description: 'A single session with every student’s marked status',
      content: { 'application/json': { schema: envelope(attendanceSessionSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Attendance session not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/attendance/sessions/{id}',
  tags: ['Attendance'],
  request: {
    params: updateAttendanceSessionSchema.params,
    body: { content: { 'application/json': { schema: updateAttendanceSessionSchema.body } } },
  },
  responses: {
    200: {
      description: 'Records replaced with the corrected set',
      content: { 'application/json': { schema: envelope(attendanceSessionSchema) } },
    },
    400: { description: 'A record references a student not actively enrolled in this course' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Attendance session not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/attendance/sessions/{id}',
  tags: ['Attendance'],
  request: { params: deleteAttendanceSessionSchema.params },
  responses: {
    200: { description: 'Attendance session deleted' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Attendance session not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/attendance/summary',
  tags: ['Attendance'],
  request: { params: getAttendanceSummarySchema.params },
  responses: {
    200: {
      description: 'FR-34: every enrolled student’s attendance percentage for this course',
      content: { 'application/json': { schema: envelope(z.array(attendanceSummaryRowSchema)) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/attendance/me',
  tags: ['Attendance'],
  request: { params: getMyAttendanceSchema.params },
  responses: {
    200: {
      description: "The caller's own attendance percentage for this course",
      content: { 'application/json': { schema: envelope(attendancePercentageSchema) } },
    },
    401: unauthenticated,
    403: studentOnly,
  },
});
