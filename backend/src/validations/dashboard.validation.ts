import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const courseSummarySchema = z.object({ id: z.uuid(), title: z.string(), code: z.string() });

const upcomingItemSchema = z.object({
  type: z.enum(['assignment', 'quiz']),
  id: z.uuid(),
  courseId: z.uuid(),
  courseTitle: z.string(),
  title: z.string(),
  dueAt: z.iso.datetime().nullable(),
});

const recentGradeItemSchema = z.object({
  type: z.enum(['assignment', 'quiz']),
  id: z.uuid(),
  courseId: z.uuid(),
  courseTitle: z.string(),
  title: z.string(),
  score: z.number(),
  maxScore: z.number(),
  gradedAt: z.iso.datetime(),
});

const performanceEvidenceSchema = registry.register(
  'StudentPerformanceEvidence',
  z.object({
    courses: z.number(),
    assessments: z.number(),
    gradedAssessments: z.number(),
    completedAssessments: z.number(),
    attendanceRecords: z.number(),
  }),
);

export const performanceCourseSchema = registry.register(
  'StudentPerformanceCourse',
  z.object({
    courseId: z.uuid(),
    courseTitle: z.string(),
    status: z.enum(['ready', 'insufficient_data']),
    averageGrade: z.number().nullable(),
    attendancePercentage: z.number().nullable(),
    completionRate: z.number().nullable(),
    missingSubmissions: z.number(),
    lateSubmissions: z.number(),
    evidence: performanceEvidenceSchema.omit({ courses: true }),
  }),
);

export const performanceSnapshotSchema = registry.register(
  'StudentPerformanceSnapshot',
  z.object({
    status: z.enum(['ready', 'insufficient_data']),
    averageGrade: z.number().nullable(),
    attendancePercentage: z.number().nullable(),
    completionRate: z.number().nullable(),
    missingSubmissions: z.number(),
    lateSubmissions: z.number(),
    evidence: performanceEvidenceSchema,
    courses: z.array(performanceCourseSchema),
  }),
);

const studentDashboardSchema = registry.register(
  'StudentDashboard',
  z.object({
    placed: z.boolean(),
    courses: z.array(courseSummarySchema),
    upcoming: z.array(upcomingItemSchema),
    recentGrades: z.array(recentGradeItemSchema),
    performance: performanceSnapshotSchema,
    unreadNotificationCount: z.number(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/dashboard/me',
  tags: ['Dashboard'],
  responses: {
    200: {
      description:
        "The student's dashboard: enrolled courses, work not yet done, recently approved grades, and unread notification count",
      content: { 'application/json': { schema: envelope(studentDashboardSchema) } },
    },
    401: { description: 'Not authenticated' },
    403: { description: 'Caller is not a student' },
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Study Plan (Slice 6 — AI-generated weekly study plan)
// ──────────────────────────────────────────────────────────────────────────────

const studyPlanTaskSchema = z.object({
  type: z.enum(['review', 'practice', 'assignment', 'quiz', 'concept']),
  title: z.string(),
  courseId: z.string().optional(),
  courseTitle: z.string().optional(),
  description: z.string(),
  estimatedMinutes: z.number().int().min(1).max(240),
  priority: z.enum(['high', 'medium', 'low']),
  done: z.boolean().optional(),
});

const studyPlanDaySchema = z.object({
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  date: z.string(),
  tasks: z.array(studyPlanTaskSchema),
});

export const studyPlanContentSchema = z.object({
  summary: z.string(),
  weekStart: z.string(),
  days: z.array(studyPlanDaySchema).length(7),
  evidence: z.object({
    upcomingAssessments: z.number(),
    weakConcepts: z.number(),
    missingSubmissions: z.number(),
    averageGrade: z.number().nullable(),
  }),
});

const studyPlanSchema = registry.register(
  'StudyPlan',
  z.object({
    id: z.uuid(),
    studentId: z.uuid(),
    weekStart: z.string(),
    content: studyPlanContentSchema,
    status: z.enum(['active', 'superseded']),
    isStale: z.boolean(),
    staleReason: z.string().nullable(),
    generatedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/dashboard/me/study-plan',
  tags: ['Dashboard'],
  responses: {
    200: {
      description: "The student's current active study plan, or null if none has been generated yet.",
      content: { 'application/json': { schema: envelope(studyPlanSchema.nullable()) } },
    },
    401: { description: 'Not authenticated' },
    403: { description: 'Caller is not a student' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/dashboard/me/study-plan',
  tags: ['Dashboard'],
  responses: {
    201: {
      description: 'A freshly AI-generated weekly study plan. Any previous active plan is superseded.',
      content: { 'application/json': { schema: envelope(studyPlanSchema) } },
    },
    401: { description: 'Not authenticated' },
    403: { description: 'Caller is not a student' },
    502: { description: 'LLM failed to produce a valid study plan after retries' },
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Study Plan Task Mutations (toggle done, delete, add custom task)
// ──────────────────────────────────────────────────────────────────────────────

export const studyPlanTaskPositionSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  taskIndex: z.number().int().min(0),
});

const newCustomTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  estimatedMinutes: z.number().int().min(5).max(240),
  priority: z.enum(['high', 'medium', 'low']),
  courseTitle: z.string().max(200).optional(),
});

export const addStudyPlanTaskBodySchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  task: newCustomTaskSchema,
});

registry.registerPath({
  method: 'patch',
  path: '/dashboard/me/study-plan/tasks',
  tags: ['Dashboard'],
  request: {
    body: {
      content: {
        'application/json': {
          schema: studyPlanTaskPositionSchema.extend({ done: z.boolean() }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Task done state toggled. Returns the updated plan.',
      content: { 'application/json': { schema: envelope(studyPlanSchema) } },
    },
    400: { description: 'dayIndex or taskIndex out of range' },
    404: { description: 'No active study plan' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/dashboard/me/study-plan/tasks',
  tags: ['Dashboard'],
  request: {
    body: {
      content: {
        'application/json': { schema: studyPlanTaskPositionSchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Task removed. Returns the updated plan.',
      content: { 'application/json': { schema: envelope(studyPlanSchema) } },
    },
    400: { description: 'dayIndex or taskIndex out of range' },
    404: { description: 'No active study plan' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/dashboard/me/study-plan/tasks',
  tags: ['Dashboard'],
  request: {
    body: {
      content: {
        'application/json': { schema: addStudyPlanTaskBodySchema },
      },
    },
  },
  responses: {
    200: {
      description: 'Custom task added to the specified day. Returns the updated plan.',
      content: { 'application/json': { schema: envelope(studyPlanSchema) } },
    },
    400: { description: 'dayIndex out of range' },
    404: { description: 'No active study plan' },
  },
});

