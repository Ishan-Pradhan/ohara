import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const studentOnly = { description: 'Caller is not a student enrolled in this course' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

// ── Request schemas ─────────────────────────────────────────────────────────

export const submitSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({ content: z.string().optional() }),
};

export const listSubmissionsSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const getSubmissionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), submissionId: z.uuid() }),
};

export const getMySubmissionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const gradeSubmissionSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), submissionId: z.uuid() }),
};

export const gradeAllSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const editGradeSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), submissionId: z.uuid() }),
  body: z.object({
    criterionFeedback: z
      .array(
        z.object({
          criterion: z.string().min(1),
          maxPoints: z.number().nonnegative(),
          awardedPoints: z.number().nonnegative(),
          feedback: z.string(),
        }),
      )
      .min(1),
    overallFeedback: z.string().nullable().optional(),
    status: z.enum(['draft', 'approved']).optional(),
  }),
};

// ── LLM output shape ─────────────────────────────────────────────────────────

export const gradedCriterionSchema = z.object({
  criterion: z.string().min(1),
  awardedPoints: z.number().nonnegative(),
  feedback: z.string(),
});

export const gradingResultSchema = z.object({
  criterionFeedback: z.array(gradedCriterionSchema).min(1),
  overallFeedback: z.string(),
});

// ── Response schemas ─────────────────────────────────────────────────────────

export const gradeSchema = registry.register(
  'Grade',
  z.object({
    id: z.uuid(),
    submissionId: z.uuid(),
    score: z.number(),
    criterionFeedback: z.array(
      z.object({
        criterion: z.string(),
        maxPoints: z.number(),
        awardedPoints: z.number(),
        feedback: z.string(),
      }),
    ),
    overallFeedback: z.string().nullable(),
    status: z.enum(['draft', 'approved']),
    approvedBy: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  }),
);

export const submissionSchema = registry.register(
  'Submission',
  z.object({
    id: z.uuid(),
    assignmentId: z.uuid(),
    studentId: z.uuid(),
    student: z.object({ id: z.uuid(), name: z.string(), email: z.string() }).optional(),
    content: z.string().nullable(),
    fileUrl: z.string().nullable(),
    fileOriginalName: z.string().nullable(),
    isLate: z.boolean(),
    submittedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    grade: gradeSchema.nullable().optional(),
  }),
);

// ── OpenAPI path registrations ───────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/assignments/{id}/submissions',
  tags: ['Submissions'],
  request: {
    params: submitSchema.params,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            content: z.string().optional(),
            file: z.string().optional().openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Submission created or resubmitted',
      content: { 'application/json': { schema: envelope(submissionSchema) } },
    },
    400: { description: 'Neither content nor a file was provided, or the file type is not allowed' },
    401: unauthenticated,
    403: studentOnly,
    409: { description: 'This submission already has an approved grade and cannot be resubmitted' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/assignments/{id}/submissions/me',
  tags: ['Submissions'],
  request: { params: getMySubmissionSchema.params },
  responses: {
    200: {
      description: "The caller's own submission — grade is included only once approved",
      content: { 'application/json': { schema: envelope(submissionSchema.nullable()) } },
    },
    401: unauthenticated,
    403: studentOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/assignments/{id}/submissions',
  tags: ['Submissions'],
  request: { params: listSubmissionsSchema.params },
  responses: {
    200: {
      description: 'All submissions for the assignment, with draft or approved grades',
      content: { 'application/json': { schema: envelope(z.array(submissionSchema)) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/assignments/{id}/submissions/{submissionId}/grade',
  tags: ['Submissions'],
  request: { params: gradeSubmissionSchema.params },
  responses: {
    200: {
      description: 'AI draft grade generated (or regenerated) for this submission',
      content: { 'application/json': { schema: envelope(gradeSchema) } },
    },
    400: { description: 'Submission has no gradable content (no text, or an unextractable file)' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Submission not found' },
    409: { description: 'Grade is already approved' },
    502: { description: 'The LLM could not produce a valid grade after a retry' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/assignments/{id}/grade-all',
  tags: ['Submissions'],
  request: { params: gradeAllSchema.params },
  responses: {
    200: {
      description: 'AI draft grading run for every ungraded submission; per-submission failures are reported, not thrown',
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/assignments/{id}/submissions/{submissionId}/grade',
  tags: ['Submissions'],
  request: {
    params: editGradeSchema.params,
    body: { content: { 'application/json': { schema: editGradeSchema.body } } },
  },
  responses: {
    200: {
      description: "Teacher's edited grade, optionally approved in the same call",
      content: { 'application/json': { schema: envelope(gradeSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Submission or grade not found' },
  },
});
