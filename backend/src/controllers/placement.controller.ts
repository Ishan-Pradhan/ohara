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
        academicYearId: section.academicYearId,
      },
      autoEnrollCourseIds,
    );

    return ok(res, serializeClassMembership(membership), 'Class membership created', 201);
  },
);

export const listClassMemberships = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId, sectionId, academicYearId } = req.validated?.query as {
      studentId?: string;
      sectionId?: string;
      academicYearId?: string;
    };
    const memberships = await classMembershipRepository.findAll({
      studentId,
      sectionId,
      academicYearId,
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
      academicYearId: membership.academicYearId,
    });

    return ok(res, serializeEnrollment(enrollment), 'Enrollment created', 201);
  },
);

export const listEnrollments = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId, courseId, academicYearId } = req.validated?.query as {
      studentId?: string;
      courseId?: string;
      academicYearId?: string;
    };
    const enrollments = await enrollmentRepository.findAll({
      studentId,
      courseId,
      academicYearId,
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

    if (targetSection.academicYearId !== membership.academicYearId) {
      throw new ApiError(
        400,
        'Transfer target must be in the same term as the membership being transferred',
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

    // Existence just confirmed above in the same request — safe to assert non-null.
    const updated = await classMembershipRepository.updateSection(id, targetSectionId);

    return ok(res, serializeClassMembership(updated!), 'Class membership transferred');
  },
);

// ── LIFECYCLE: OUTCOME (PROMOTE / RETAIN / GRADUATE) ─────────────────────────

/**
 * Applies one outcome to one membership. Shared by the single-student route
 * below and Task 5's bulk-promote route — the guards (same program, exactly
 * the next class, not already advanced, graduate only from the program's
 * last class) must hold identically in both places.
 */
export const applyOutcome = async (
  membership: ClassMembership,
  outcome: 'promoted' | 'retained' | 'graduated',
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

  const currentSection = await sectionRepository.findById(membership.sectionId);
  if (!currentSection) {
    throw new ApiError(500, 'Membership references a missing section');
  }
  const currentClass = await classRepository.findById(currentSection.classId);
  if (!currentClass) {
    throw new ApiError(500, 'Section references a missing class');
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
    throw new ApiError(400, 'targetSectionId is required for promoted/retained');
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
    throw new ApiError(400, 'Promotion and retention must stay within the same program');
  }
  if (outcome === 'promoted' && targetClass.orderIndex !== currentClass.orderIndex + 1) {
    throw new ApiError(400, 'Promotion must move to the next class in the program');
  }
  if (outcome === 'retained' && targetClass.id !== currentClass.id) {
    throw new ApiError(400, 'Retention must stay in the same class');
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
      academicYearId: targetSection.academicYearId,
    },
    outcome,
    autoEnrollCourseIds,
  );
};

export const setClassMembershipOutcome = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.validated?.params as { id: string };
    const { outcome, targetSectionId } = req.validated?.body as {
      outcome: 'promoted' | 'retained' | 'graduated';
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
  outcome: 'retained' | 'graduated';
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
