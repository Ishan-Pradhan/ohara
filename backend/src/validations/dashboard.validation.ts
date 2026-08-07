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

export const learningProfileInterpretationSchema = registry.register(
  'LearningProfileInterpretation',
  z.object({
    summary: z.string(),
    strengths: z.array(z.string()),
    attentionAreas: z.array(z.string()),
    nextActions: z.array(z.string()),
    courseInsights: z.array(
      z.object({
        courseId: z.uuid(),
        courseTitle: z.string(),
        status: z.enum(['strong', 'developing', 'needs_attention', 'insufficient_data']),
        note: z.string(),
      }),
    ),
  }),
);

const learningProfileSchema = registry.register(
  'LearningProfile',
  z.object({
    snapshot: performanceSnapshotSchema,
    profile: learningProfileInterpretationSchema,
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

registry.registerPath({
  method: 'get',
  path: '/dashboard/me/learning-profile',
  tags: ['Dashboard'],
  responses: {
    200: {
      description:
        'A deterministic student performance snapshot and an AI interpretation of what it means, grounded in real academic evidence',
      content: { 'application/json': { schema: envelope(learningProfileSchema) } },
    },
    401: { description: 'Not authenticated' },
    403: { description: 'Caller is not a student' },
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Concept Inventory (Slice 3 — evidence-based concept representation)
// ──────────────────────────────────────────────────────────────────────────────

const conceptSnapshotSchema = z.object({
  topic: z.string(),
  masteryState: z.enum(['strong', 'developing', 'needs_attention', 'insufficient_data']),
  evidenceType: z.enum(['indirect', 'none']),
});

const courseConceptsSchema = registry.register(
  'CourseConcepts',
  z.object({
    courseId: z.uuid(),
    courseTitle: z.string(),
    concepts: z.array(conceptSnapshotSchema),
    quizEvidence: z.object({
      quizCount: z.number(),
      attemptedCount: z.number(),
      averageScorePercentage: z.number().nullable(),
    }),
    hasTopics: z.boolean(),
    hasQuizEvidence: z.boolean(),
  }),
);

export const conceptInventorySchema = registry.register(
  'ConceptInventory',
  z.object({
    totalConcepts: z.number(),
    conceptsWithEvidence: z.number(),
    courses: z.array(courseConceptsSchema),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/dashboard/me/concepts',
  tags: ['Dashboard'],
  responses: {
    200: {
      description:
        "The student's concept inventory: all lesson keyTopics per enrolled course with mastery states derived from quiz performance evidence.",
      content: { 'application/json': { schema: envelope(conceptInventorySchema) } },
    },
    401: { description: 'Not authenticated' },
    403: { description: 'Caller is not a student' },
  },
});

// ──────────────────────────────────────────────────────────────────────────────
// Mastery Report (Slice 4 — per-question MCQ + per-criterion weakness)
// ──────────────────────────────────────────────────────────────────────────────

const masteryStateEnum = z.enum(['strong', 'developing', 'needs_attention', 'insufficient_data']);

const weakQuestionSchema = z.object({
  questionId: z.uuid(),
  prompt: z.string(),
  attempts: z.number(),
  correct: z.number(),
  correctRate: z.number(),
  masteryState: z.enum(['developing', 'needs_attention']),
});

const weakCriterionSchema = z.object({
  criterion: z.string(),
  scoreRate: z.number(),
  masteryState: z.enum(['developing', 'needs_attention']),
});

const courseMasteryReportSchema = registry.register(
  'CourseMasteryReport',
  z.object({
    courseId: z.uuid(),
    courseTitle: z.string(),
    overallMastery: masteryStateEnum,
    mcqMasteryPercentage: z.number().nullable(),
    weakQuestions: z.array(weakQuestionSchema),
    weakCriteria: z.array(weakCriterionSchema),
    evidence: z.object({
      mcqQuestionsAttempted: z.number(),
      totalMcqQuestions: z.number(),
      criteriaEvaluated: z.number(),
    }),
  }),
);

export const masteryReportSchema = registry.register(
  'MasteryReport',
  z.object({
    coursesWithEvidence: z.number(),
    coursesNeedingAttention: z.number(),
    courses: z.array(courseMasteryReportSchema),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/dashboard/me/mastery',
  tags: ['Dashboard'],
  responses: {
    200: {
      description:
        "Per-question MCQ correctness and per-criterion assignment weakness for the student's enrolled courses. Thresholds: strong ≥ 80%, developing ≥ 60%, needs_attention < 60%.",
      content: { 'application/json': { schema: envelope(masteryReportSchema) } },
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

// ──────────────────────────────────────────────────────────────────────────────
// Exam Prep (Slice 8)
// ──────────────────────────────────────────────────────────────────────────────

export const examPrepQuerySchema = z.object({
  assessmentType: z.enum(['quiz', 'assignment']),
  assessmentId: z.uuid(),
});

const examPrepAIOutputSchema = z.object({
  explanation: z.string(),
  recommendations: z.array(z.string()).min(1).max(5),
});

const examPrepEvidenceSchema = z.record(z.string(), z.unknown());

export const examPrepResponseSchema = registry.register(
  'ExamPrepResponse',
  z.object({
    assessmentType: z.enum(['quiz', 'assignment']),
    assessmentId: z.uuid(),
    assessmentTitle: z.string(),
    courseId: z.uuid(),
    courseTitle: z.string(),
    readinessScore: z.number().nullable(),
    readinessState: z.enum(['ready', 'developing', 'needs_attention', 'insufficient_data']),
    weakAreas: z.array(z.string()),
    alreadyCompleted: z.boolean(),
    ai: examPrepAIOutputSchema.nullable(),
    evidence: examPrepEvidenceSchema,
  }),
);

export const examPrepAISchema = examPrepAIOutputSchema;

registry.registerPath({
  method: 'get',
  path: '/dashboard/me/exam-prep',
  tags: ['Dashboard'],
  request: {
    query: examPrepQuerySchema,
  },
  responses: {
    200: {
      description:
        'Deterministic readiness assessment for a specific quiz or assignment, with an AI explanation and review recommendations grounded in real evidence.',
      content: { 'application/json': { schema: envelope(examPrepResponseSchema) } },
    },
    400: { description: 'Missing or invalid query parameters' },
    401: { description: 'Not authenticated' },
    403: { description: 'Caller is not a student or does not have access to this assessment' },
    404: { description: 'Assessment not found' },
  },
});
