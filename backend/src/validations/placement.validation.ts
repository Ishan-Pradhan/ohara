import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not authorized' };

// ── CLASS MEMBERSHIPS ───────────────────────────────────────────────────────

export const createClassMembershipSchema = {
  body: z.object({
    studentId: z.uuid(),
    sectionId: z.uuid(),
    batchId: z.uuid(),
  }),
};

export const listClassMembershipsSchema = {
  query: z.object({
    studentId: z.uuid().optional(),
    sectionId: z.uuid().optional(),
    academicYearId: z.uuid().optional(),
  }),
};

export const classMembershipSchema = registry.register(
  'ClassMembership',
  z.object({
    id: z.uuid(),
    studentId: z.uuid(),
    batchId: z.uuid(),
    sectionId: z.uuid(),
    academicYearId: z.uuid(),
    outcome: z.enum(['enrolled', 'promoted', 'retained', 'graduated', 'transferred']),
    promotedToId: z.uuid().nullable(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/class-memberships',
  tags: ['Placement'],
  request: {
    body: {
      content: { 'application/json': { schema: createClassMembershipSchema.body } },
    },
  },
  responses: {
    201: {
      description: 'Class membership created',
      content: { 'application/json': { schema: envelope(classMembershipSchema) } },
    },
    400: {
      description:
        'Validation failed, studentId is not a student, or already placed for this academic year',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Student or section not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/class-memberships',
  tags: ['Placement'],
  request: { query: listClassMembershipsSchema.query },
  responses: {
    200: {
      description: 'List of class memberships',
      content: {
        'application/json': { schema: envelope(z.array(classMembershipSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

// ── ENROLLMENTS ──────────────────────────────────────────────────────────────

export const createEnrollmentSchema = {
  body: z.object({
    studentId: z.uuid(),
    courseId: z.uuid(),
  }),
};

export const listEnrollmentsSchema = {
  query: z.object({
    studentId: z.uuid().optional(),
    courseId: z.uuid().optional(),
    academicYearId: z.uuid().optional(),
  }),
};

export const enrollmentSchema = registry.register(
  'Enrollment',
  z.object({
    id: z.uuid(),
    studentId: z.uuid(),
    courseId: z.uuid(),
    academicYearId: z.uuid(),
    status: z.enum(['active', 'completed', 'dropped']),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/enrollments',
  tags: ['Placement'],
  request: {
    body: { content: { 'application/json': { schema: createEnrollmentSchema.body } } },
  },
  responses: {
    201: {
      description: 'Enrollment created',
      content: { 'application/json': { schema: envelope(enrollmentSchema) } },
    },
    400: { description: 'Validation failed, or already enrolled' },
    401: unauthenticated,
    403: forbidden,
    404: {
      description:
        'Student, course, current academic year, or current-year placement not found',
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/enrollments',
  tags: ['Placement'],
  request: { query: listEnrollmentsSchema.query },
  responses: {
    200: {
      description: 'List of enrollments',
      content: { 'application/json': { schema: envelope(z.array(enrollmentSchema)) } },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

// ── LIFECYCLE: TRANSFER ──────────────────────────────────────────────────────

const membershipIdParams = { params: z.object({ id: z.uuid() }) };

export const transferClassMembershipSchema = {
  params: membershipIdParams.params,
  body: z.object({ targetSectionId: z.uuid() }),
};

/** Full reassign — the student can be moved to any section (any program,
 * class, and academic year/term) and any batch of that new program. The old
 * placement is closed out with outcome 'transferred' and its active course
 * enrollments completed; the new class's compulsory courses are auto-enrolled. */
export const reassignClassMembershipSchema = {
  params: membershipIdParams.params,
  body: z.object({
    targetSectionId: z.uuid(),
    targetBatchId: z.uuid(),
  }),
};

registry.registerPath({
  method: 'post',
  path: '/admin/class-memberships/{id}/transfer',
  tags: ['Placement'],
  request: {
    params: transferClassMembershipSchema.params,
    body: {
      content: { 'application/json': { schema: transferClassMembershipSchema.body } },
    },
  },
  responses: {
    200: {
      description: 'Class membership transferred to a new section',
      content: { 'application/json': { schema: envelope(classMembershipSchema) } },
    },
    400: {
      description: 'Validation failed, or membership is not for the current academic year',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Class membership or target section not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/class-memberships/{id}/reassign',
  tags: ['Placement'],
  request: {
    params: reassignClassMembershipSchema.params,
    body: {
      content: { 'application/json': { schema: reassignClassMembershipSchema.body } },
    },
  },
  responses: {
    200: {
      description:
        'Student reassigned to the target section and batch, anywhere in the institution. The superseded membership is closed out with outcome `transferred`, old active course enrollments are completed, and the target class\u2019s compulsory courses are auto-enrolled.',
      content: { 'application/json': { schema: envelope(classMembershipSchema) } },
    },
    400: {
      description:
        'Validation failed, student is not active, membership already advanced, or target batch belongs to a different program than the target section',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Class membership, target section, or target batch not found' },
  },
});

// ── LIFECYCLE: OUTCOME (PROMOTE / RETAIN / GRADUATE) ─────────────────────────

export const setClassMembershipOutcomeSchema = {
  params: membershipIdParams.params,
  body: z.object({
    outcome: z.enum(['promoted', 'retained', 'graduated']),
    targetSectionId: z.uuid().optional(),
  }),
};

registry.registerPath({
  method: 'post',
  path: '/admin/class-memberships/{id}/outcome',
  tags: ['Placement'],
  request: {
    params: setClassMembershipOutcomeSchema.params,
    body: {
      content: { 'application/json': { schema: setClassMembershipOutcomeSchema.body } },
    },
  },
  responses: {
    201: {
      description:
        "Outcome recorded. For promoted/retained, a new class membership is created for the current academic year (auto-enrolling if the target program is school-type); for graduated, the student's status is set to graduated and no new membership is created",
      content: { 'application/json': { schema: envelope(classMembershipSchema) } },
    },
    400: {
      description:
        'Validation failed, targetSectionId missing for promoted/retained, or membership is already for the current academic year',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Class membership or target section not found' },
  },
});

// ── BULK PROMOTION ────────────────────────────────────────────────────────

const sectionIdParams = { params: z.object({ sectionId: z.uuid() }) };

export const getSectionRosterSchema = sectionIdParams;

const rosterStudentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  status: z.string(),
  avatarUrl: z.string().nullable(),
});

registry.registerPath({
  method: 'get',
  path: '/admin/sections/{sectionId}/roster',
  tags: ['Placement'],
  request: { params: getSectionRosterSchema.params },
  responses: {
    200: {
      description: "The section's active membership roster",
      content: {
        'application/json': {
          schema: envelope(
            z.array(z.object({ membershipId: z.uuid(), student: rosterStudentSchema })),
          ),
        },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

export const bulkPromoteSectionSchema = {
  params: sectionIdParams.params,
  body: z.object({
    defaultTargetSectionId: z.uuid(),
    overrides: z
      .array(
        z.object({
          studentId: z.uuid(),
          outcome: z.enum(['retained', 'graduated']),
          targetSectionId: z.uuid().optional(),
        }),
      )
      .default([]),
  }),
};

const bulkPromoteResultSchema = z.object({
  studentId: z.uuid(),
  status: z.enum(['ok', 'error']),
  membership: classMembershipSchema.optional(),
  error: z.string().optional(),
});

registry.registerPath({
  method: 'post',
  path: '/admin/sections/{sectionId}/promote',
  tags: ['Placement'],
  request: {
    params: bulkPromoteSectionSchema.params,
    body: { content: { 'application/json': { schema: bulkPromoteSectionSchema.body } } },
  },
  responses: {
    200: {
      description:
        'One result per student in the section: every student not named in `overrides` is promoted to defaultTargetSectionId; overridden students get their specified outcome instead. Per-student failures (e.g. a student already promoted since the page loaded) are reported individually and do not abort the rest of the batch.',
      content: {
        'application/json': { schema: envelope(z.array(bulkPromoteResultSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Section not found' },
  },
});
