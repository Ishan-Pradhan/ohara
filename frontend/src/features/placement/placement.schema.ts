import { z } from 'zod';

/* Mirrors backend/src/validations/placement.validation.ts and students.validation.ts. */

export const createClassMembershipSchema = z.object({
  studentId: z.string().min(1),
  sectionId: z.string().min(1, 'Choose a section'),
  batchId: z.string().min(1, 'Choose a batch'),
});

export const classMembershipSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  batchId: z.string(),
  sectionId: z.string(),
  academicYearId: z.string(),
  outcome: z.enum(['enrolled', 'promoted', 'retained', 'graduated']),
  promotedToId: z.string().nullable(),
  createdAt: z.string(),
});

export const createEnrollmentSchema = z.object({
  studentId: z.string().min(1),
  courseId: z.string().min(1, 'Choose a course'),
});

export const enrollmentSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  courseId: z.string(),
  academicYearId: z.string(),
  status: z.enum(['active', 'completed', 'dropped']),
  createdAt: z.string(),
});

export const transferSchema = z.object({
  targetSectionId: z.string().min(1, 'Choose a section'),
});

export const outcomeSchema = z
  .object({
    outcome: z.enum(['promoted', 'retained', 'graduated']),
    targetSectionId: z.string().optional(),
  })
  .refine((val) => val.outcome === 'graduated' || Boolean(val.targetSectionId), {
    message: 'Choose a target section',
    path: ['targetSectionId'],
  });

export const studentPlacementSchema = z.object({
  studentId: z.string(),
  program: z
    .object({
      id: z.string(),
      name: z.string(),
      institutionType: z.string(),
      affiliation: z.string().nullable(),
    })
    .nullable(),
  class: z.object({ id: z.string(), name: z.string() }).nullable(),
  section: z.object({ id: z.string(), name: z.string() }).nullable(),
  academicYear: z.object({ id: z.string(), name: z.string() }).nullable(),
  batch: z.object({ id: z.string(), name: z.string() }).nullable(),
  courses: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      code: z.string(),
      isPublished: z.boolean(),
      teachers: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
});

export const rosterEntrySchema = z.object({
  membershipId: z.string(),
  student: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    status: z.string(),
    avatarUrl: z.string().nullable(),
  }),
});

export const bulkPromoteInputSchema = z.object({
  defaultTargetSectionId: z.string().min(1, 'Choose a target section'),
  overrides: z.array(
    z.object({
      studentId: z.string(),
      outcome: z.enum(['retained', 'graduated']),
      targetSectionId: z.string().optional(),
    }),
  ),
});

export const bulkPromoteResultSchema = z.object({
  studentId: z.string(),
  status: z.enum(['ok', 'error']),
  membership: classMembershipSchema.optional(),
  error: z.string().optional(),
});

export const electiveCourseSchema = z.object({
  id: z.string(),
  classId: z.string(),
  title: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  capacity: z.number().nullable(),
  enrolledCount: z.number(),
  isEnrolled: z.boolean(),
});

export type CreateClassMembershipInput = z.infer<typeof createClassMembershipSchema>;
export type ClassMembership = z.infer<typeof classMembershipSchema>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type Enrollment = z.infer<typeof enrollmentSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type OutcomeInput = z.infer<typeof outcomeSchema>;
export type StudentPlacement = z.infer<typeof studentPlacementSchema>;
export type RosterEntry = z.infer<typeof rosterEntrySchema>;
export type BulkPromoteInput = z.infer<typeof bulkPromoteInputSchema>;
export type BulkPromoteResult = z.infer<typeof bulkPromoteResultSchema>;
export type ElectiveCourse = z.infer<typeof electiveCourseSchema>;
