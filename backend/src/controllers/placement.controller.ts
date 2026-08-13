import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type { ClassMembership } from '../models/classMemberships.model.js';
import type {
  ClassMembershipCreationAttributes,
  EnrollmentCreationAttributes,
} from '../types/placement.types.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { batchRepository } from '../repositories/batches.repository.js';
import {
  serializeClassMembership,
  serializeEnrollment,
} from '../serializers/placement.serializer.js';
import { serializeRosterStudent } from '../serializers/user.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// ── CLASS MEMBERSHIPS ───────────────────────────────────────────────────────

export const createClassMembership = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId, sectionId, batchId } =
      req.validated?.body as ClassMembershipCreationAttributes;

    const student = await userRepository.findById(studentId);
    if (!student) {
      throw new ApiError(404, 'Student not found');
    }
    if (student.role !== 'student') {
      throw new ApiError(400, 'studentId must reference a student');
    }

    const section = await sectionRepository.findById(sectionId);
    if (!section) {
      throw new ApiError(404, 'Section not found');
    }

    const cls = await classRepository.findById(section.classId);
    if (!cls) {
      throw new ApiError(500, 'Section references a missing class');
    }

    if (section.capacity !== null) {
      const counts = await classMembershipRepository.countBySections([sectionId]);
      if ((counts[sectionId] ?? 0) >= section.capacity) {
        throw new ApiError(400, `Section '${section.name}' is at capacity (${section.capacity}).`);
      }
    }

    const batch = await batchRepository.findById(batchId);
    if (!batch) {
      throw new ApiError(404, 'Batch not found');
    }
    if (batch.programId !== cls.programId) {
      throw new ApiError(400, 'Batch must belong to the same program as the target section');
    }

    const classCourses = await courseRepository.findAll({ classId: section.classId });
    const autoEnrollCourseIds = classCourses
      .filter((course) => course.courseType === 'compulsory')
      .map((course) => course.id);

    const membership = await classMembershipRepository.create(
      {
        studentId,
        batchId,
        sectionId,
        classId: section.classId,
      },
      autoEnrollCourseIds,
    );

    return ok(res, serializeClassMembership(membership), 'Class membership created', 201);
  },
);

export const listClassMemberships = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId, sectionId, classId } = req.validated?.query as {
      studentId?: string;
      sectionId?: string;
      classId?: string;
    };
    const memberships = await classMembershipRepository.findAll({
      studentId,
      sectionId,
      classId,
    });
    return ok(res, memberships.map(serializeClassMembership), 'Class memberships retrieved');
  },
);

// ── ENROLLMENTS ──────────────────────────────────────────────────────────────

export const createEnrollment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId, courseId } =
      req.validated?.body as EnrollmentCreationAttributes;

    const student = await userRepository.findById(studentId);
    if (!student) {
      throw new ApiError(404, 'Student not found');
    }
    if (student.role !== 'student') {
      throw new ApiError(400, 'studentId must reference a student');
    }

    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new ApiError(404, 'Course not found');
    }

    const membership = await classMembershipRepository.findCurrent(studentId);
    if (!membership) {
      throw new ApiError(404, 'Student is not currently placed');
    }

    const enrollment = await enrollmentRepository.create({
      studentId,
      courseId,
      batchId: membership.batchId,
    });

    return ok(res, serializeEnrollment(enrollment), 'Enrollment created', 201);
  },
);

export const listEnrollments = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId, courseId, batchId } = req.validated?.query as {
      studentId?: string;
      courseId?: string;
      batchId?: string;
    };
    const enrollments = await enrollmentRepository.findAll({
      studentId,
      courseId,
      batchId,
    });
    return ok(res, enrollments.map(serializeEnrollment), 'Enrollments retrieved');
  },
);

// ── LIFECYCLE: TRANSFER ──────────────────────────────────────────────────────

export const transferClassMembership = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const { targetSectionId } = req.validated?.body as { targetSectionId: string };

    const membership = await classMembershipRepository.findById(id);
    if (!membership) {
      throw new ApiError(404, 'Class membership not found');
    }

    const student = await userRepository.findById(membership.studentId);
    if (!student || student.status !== 'active') {
      throw new ApiError(
        400,
        'This student is not active and cannot be transferred',
      );
    }

    if (membership.promotedToId !== null) {
      throw new ApiError(400, "Only a student's current placement can be transferred");
    }

    const targetSection = await sectionRepository.findById(targetSectionId);
    if (!targetSection) {
      throw new ApiError(404, 'Target section not found');
    }

    if (targetSection.batchId !== membership.batchId) {
      throw new ApiError(
        400,
        "Transfer target must be for the student's own batch — moving a student to a " +
          'different batch is a reassign, not a transfer',
      );
    }

    // Cross-class transfer would leave the student's existing course enrollments (scoped to
    // the old class's courses) stale — resyncing them is out of scope for now, so restrict
    // transfers to the same class until that's built.
    const currentSection = await sectionRepository.findById(membership.sectionId);
    if (!currentSection || targetSection.classId !== currentSection.classId) {
      throw new ApiError(
        400,
        'Transfer is only supported within the same class (cross-class transfer is not yet supported)',
      );
    }

    if (targetSectionId !== membership.sectionId && targetSection.capacity !== null) {
      const counts = await classMembershipRepository.countBySections([targetSectionId]);
      if ((counts[targetSectionId] ?? 0) >= targetSection.capacity) {
        throw new ApiError(
          400,
          `Target section '${targetSection.name}' is at capacity (${targetSection.capacity}).`,
        );
      }
    }

    // Existence just confirmed above in the same request — safe to assert non-null.
    const updated = await classMembershipRepository.updateSection(id, targetSectionId);

    return ok(res, serializeClassMembership(updated!), 'Class membership transferred');
  },
);

export const reassignClassMembership = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const { targetSectionId, targetBatchId } = req.validated?.body as {
      targetSectionId: string;
      targetBatchId: string;
    };

    const membership = await classMembershipRepository.findById(id);
    if (!membership) {
      throw new ApiError(404, 'Class membership not found');
    }

    const student = await userRepository.findById(membership.studentId);
    if (!student || student.status !== 'active') {
      throw new ApiError(400, 'This student is not active and cannot be transferred');
    }
    if (membership.promotedToId !== null) {
      throw new ApiError(400, "Only a student's current placement can be transferred");
    }

    const targetSection = await sectionRepository.findById(targetSectionId);
    if (!targetSection) {
      throw new ApiError(404, 'Target section not found');
    }
    const targetClass = await classRepository.findById(targetSection.classId);
    if (!targetClass) {
      throw new ApiError(500, 'Target section references a missing class');
    }

    const targetBatch = await batchRepository.findById(targetBatchId);
    if (!targetBatch) {
      throw new ApiError(404, 'Target batch not found');
    }
    if (targetBatch.programId !== targetClass.programId) {
      throw new ApiError(400, 'Target batch must belong to the same program as the target section');
    }

    if (targetSectionId !== membership.sectionId && targetSection.capacity !== null) {
      const counts = await classMembershipRepository.countBySections([targetSectionId]);
      if ((counts[targetSectionId] ?? 0) >= targetSection.capacity) {
        throw new ApiError(
          400,
          `Target section '${targetSection.name}' is at capacity (${targetSection.capacity}).`,
        );
      }
    }

    // A student can hold only one membership per class, ever — not just
    // currently (see 20260813130000's unique index). Moving into a
    // different class the student already has a record in (e.g. an earlier
    // class in their own history) would otherwise surface as a raw DB
    // constraint error instead of an actionable one.
    if (targetSection.classId !== membership.classId) {
      const priorInTargetClass = await classMembershipRepository.findAll({
        studentId: membership.studentId,
        classId: targetSection.classId,
      });
      if (priorInTargetClass.length > 0) {
        throw new ApiError(
          400,
          'This student already has a placement record in that class, from earlier in their history.',
        );
      }
    }

    const classCourses = await courseRepository.findAll({ classId: targetSection.classId });
    const autoEnrollCourseIds = classCourses
      .filter((course) => course.courseType === 'compulsory')
      .map((course) => course.id);

    const updated = await classMembershipRepository.reassign(
      id,
      {
        studentId: membership.studentId,
        batchId: targetBatchId,
        sectionId: targetSectionId,
        classId: targetSection.classId,
      },
      autoEnrollCourseIds,
    );

    return ok(res, serializeClassMembership(updated), 'Student reassigned');
  },
);

// ── LIFECYCLE: OUTCOME (PROMOTE / GRADUATE) ──────────────────────────────────

/**
 * Applies one outcome to one membership. Shared by the single-student route
 * below and the bulk-promote route — the guards (same program, exactly the
 * next class, same batch, not already advanced, graduate only from the
 * program's last class) must hold identically in both places.
 *
 * No `retained` outcome: Nepali affiliated-university programs promote
 * unconditionally — a failed final exam is a re-exam concern (administered
 * by the affiliated university, out of scope here), not a repeated
 * semester. Promotion also never changes a student's batch — a batch's own
 * progression through Sem 1..N is the single source of truth for "which
 * one is current," so the target section must belong to the same batch as
 * the current placement.
 */
export const applyOutcome = async (
  membership: ClassMembership,
  outcome: 'promoted' | 'graduated',
  targetSectionId?: string,
): Promise<ClassMembership> => {
  const student = await userRepository.findById(membership.studentId);
  if (!student || student.status !== 'active') {
    throw new ApiError(400, 'This student is not active and cannot have an outcome recorded');
  }

  if (membership.promotedToId !== null) {
    throw new ApiError(400, 'This membership has already been advanced');
  }
  if (membership.outcome === 'graduated') {
    throw new ApiError(
      400,
      'This membership has already recorded a graduation and cannot be changed',
    );
  }

  const currentClass = await classRepository.findById(membership.classId);
  if (!currentClass) {
    throw new ApiError(500, 'Membership references a missing class');
  }

  if (outcome === 'graduated') {
    const programClasses = await classRepository.findAll({ programId: currentClass.programId });
    const maxOrderIndex = Math.max(...programClasses.map((c) => c.orderIndex));
    if (currentClass.orderIndex !== maxOrderIndex) {
      throw new ApiError(400, "Only a student in the program's final class can be graduated");
    }
    return await classMembershipRepository.graduate(membership.id, membership.studentId);
  }

  if (!targetSectionId) {
    throw new ApiError(400, 'targetSectionId is required for promotion');
  }

  const targetSection = await sectionRepository.findById(targetSectionId);
  if (!targetSection) {
    throw new ApiError(404, 'Target section not found');
  }
  const targetClass = await classRepository.findById(targetSection.classId);
  if (!targetClass) {
    throw new ApiError(500, 'Target section references a missing class');
  }

  if (targetClass.programId !== currentClass.programId) {
    throw new ApiError(400, 'Promotion must stay within the same program');
  }
  if (targetClass.orderIndex !== currentClass.orderIndex + 1) {
    throw new ApiError(400, 'Promotion must move to the next class in the program');
  }
  if (targetSection.batchId !== membership.batchId) {
    throw new ApiError(
      400,
      "A student's batch never changes on promotion — the target section must belong to the " +
        'same batch as the current placement. Create (or pick) that batch\'s section for the ' +
        'next class before promoting.',
    );
  }

  // A student can hold only one membership per class (DB-enforced). Surface that clearly
  // instead of a raw DB 500 — most often this means the student was already promoted into
  // this class earlier (e.g. via reassign) and is being promoted again by mistake.
  const priorInTargetClass = await classMembershipRepository.findAll({
    studentId: membership.studentId,
    classId: targetClass.id,
  });
  if (targetSection.capacity !== null) {
    const counts = await classMembershipRepository.countBySections([targetSectionId]);
    if ((counts[targetSectionId] ?? 0) >= targetSection.capacity) {
      throw new ApiError(
        400,
        `Target section '${targetSection.name}' is at capacity (${targetSection.capacity}).`,
      );
    }
  }

  if (priorInTargetClass.length > 0) {
    throw new ApiError(
      400,
      'This student already has a placement record in that class, from earlier in their history.',
    );
  }

  const classCourses = await courseRepository.findAll({ classId: targetSection.classId });
  const autoEnrollCourseIds = classCourses
    .filter((course) => course.courseType === 'compulsory')
    .map((course) => course.id);

  return await classMembershipRepository.promote(
    membership.id,
    {
      studentId: membership.studentId,
      batchId: membership.batchId,
      sectionId: targetSectionId,
      classId: targetSection.classId,
    },
    outcome,
    autoEnrollCourseIds,
  );
};

export const setClassMembershipOutcome = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const { outcome, targetSectionId } = req.validated?.body as {
      outcome: 'promoted' | 'graduated';
      targetSectionId?: string;
    };

    const membership = await classMembershipRepository.findById(id);
    if (!membership) {
      throw new ApiError(404, 'Class membership not found');
    }

    const updated = await applyOutcome(membership, outcome, targetSectionId);
    const message = outcome === 'graduated' ? 'Student graduated' : 'Outcome recorded';
    return ok(res, serializeClassMembership(updated), message, 201);
  },
);

// ── BULK PROMOTION ────────────────────────────────────────────────────────

export const getSectionRoster = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { sectionId } = req.validated?.params as { sectionId: string };

    const memberships = await classMembershipRepository.findBySectionWithStudents(sectionId);
    const roster = memberships
      .filter((m) => m.student)
      .map((m) => ({ membershipId: m.id, student: serializeRosterStudent(m.student!) }));

    return ok(res, roster, 'Roster retrieved');
  },
);

interface BulkPromoteOverride {
  studentId: string;
  outcome: 'promoted' | 'graduated';
  /** Only meaningful for outcome: 'promoted' — send this student to a
   * different section than the batch-wide default (e.g. splitting a large
   * section across two target sections). Ignored for 'graduated'. */
  targetSectionId?: string;
}

export const bulkPromoteSection = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { sectionId } = req.validated?.params as { sectionId: string };
    const { defaultTargetSectionId, overrides } = req.validated?.body as {
      defaultTargetSectionId: string;
      overrides: BulkPromoteOverride[];
    };

    const memberships = await classMembershipRepository.findBySectionWithStudents(sectionId);
    const overrideByStudent = new Map(overrides.map((o) => [o.studentId, o]));

    const results = await Promise.all(
      memberships.map(async (membership) => {
        const override = overrideByStudent.get(membership.studentId);
        const outcome = override?.outcome ?? 'promoted';
        const targetSectionId =
          outcome === 'graduated' ? undefined : (override?.targetSectionId ?? defaultTargetSectionId);

        try {
          const updated = await applyOutcome(membership, outcome, targetSectionId);
          return {
            studentId: membership.studentId,
            status: 'ok' as const,
            membership: serializeClassMembership(updated),
          };
        } catch (error) {
          const message = error instanceof ApiError ? error.message : 'Unexpected error';
          return { studentId: membership.studentId, status: 'error' as const, error: message };
        }
      }),
    );

    return ok(res, results, 'Bulk promotion complete');
  },
);
