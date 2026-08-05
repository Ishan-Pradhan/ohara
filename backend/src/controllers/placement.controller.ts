import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type {
  ClassMembershipCreationAttributes,
  EnrollmentCreationAttributes,
} from '../types/placement.types.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { batchRepository } from '../repositories/batches.repository.js';
import {
  serializeClassMembership,
  serializeEnrollment,
} from '../serializers/placement.serializer.js';
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

    const currentYear = await academicYearRepository.findCurrent();
    if (!currentYear) {
      throw new ApiError(404, 'No current academic year is set');
    }

    const membership = await classMembershipRepository.findByStudentAndYear(
      studentId,
      currentYear.id,
    );
    if (!membership) {
      throw new ApiError(404, 'Student is not placed for the current academic year');
    }

    const enrollment = await enrollmentRepository.create({
      studentId,
      courseId,
      academicYearId: currentYear.id,
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

    const currentYear = await academicYearRepository.findCurrent();
    if (!currentYear || membership.academicYearId !== currentYear.id) {
      throw new ApiError(
        400,
        'Only a membership for the current academic year can be transferred',
      );
    }

    const targetSection = await sectionRepository.findById(targetSectionId);
    if (!targetSection) {
      throw new ApiError(404, 'Target section not found');
    }

    if (targetSection.academicYearId !== currentYear.id) {
      throw new ApiError(
        400,
        'Target section must belong to the current academic year',
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

    const student = await userRepository.findById(membership.studentId);
    if (!student || student.status !== 'active') {
      throw new ApiError(
        400,
        'This student is not active and cannot have an outcome recorded',
      );
    }

    const currentYear = await academicYearRepository.findCurrent();
    if (!currentYear) {
      throw new ApiError(404, 'No current academic year is set');
    }
    if (membership.academicYearId === currentYear.id) {
      throw new ApiError(400, 'This membership is already for the current academic year');
    }
    if (membership.outcome === 'graduated') {
      throw new ApiError(
        400,
        'This membership has already recorded a graduation and cannot be changed',
      );
    }

    if (outcome === 'graduated') {
      const updated = await classMembershipRepository.graduate(id, membership.studentId);
      return ok(res, serializeClassMembership(updated), 'Student graduated', 201);
    }

    if (!targetSectionId) {
      throw new ApiError(400, 'targetSectionId is required for promoted/retained');
    }

    const targetSection = await sectionRepository.findById(targetSectionId);
    if (!targetSection) {
      throw new ApiError(404, 'Target section not found');
    }

    if (targetSection.academicYearId !== currentYear.id) {
      throw new ApiError(400, 'Target section must belong to the current academic year');
    }

    const classCourses = await courseRepository.findAll({ classId: targetSection.classId });
    const autoEnrollCourseIds = classCourses
      .filter((course) => course.courseType === 'compulsory')
      .map((course) => course.id);

    const newMembership = await classMembershipRepository.promote(
      id,
      {
        studentId: membership.studentId,
        // Carried forward, never re-picked — a batch/cohort stays fixed across promotion
        // (see docs/superpowers/specs/2026-08-05-semester-batch-model-design.md). The rest of
        // this function's guards (program/order_index scoping, chain-derived "current") are
        // rewritten in full by Task 4; this line only keeps batchId's new NOT NULL constraint
        // satisfied here in the meantime.
        batchId: membership.batchId,
        sectionId: targetSectionId,
        academicYearId: targetSection.academicYearId,
      },
      outcome,
      autoEnrollCourseIds,
    );

    return ok(res, serializeClassMembership(newMembership), 'Outcome recorded', 201);
  },
);
