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
import { programRepository } from '../repositories/programs.repository.js';
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
    const { studentId, sectionId } =
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
    // Section.classId is FK-enforced against Classes — a missing class here would mean the
    // DB is in an inconsistent state, not a normal 404 case, so let it surface as a 500.
    const program = await programRepository.findById(cls!.programId);

    let autoEnrollCourseIds: string[] = [];
    if (program?.institutionType === 'school') {
      const courses = await courseRepository.findAll({ classId: section.classId });
      autoEnrollCourseIds = courses.map((course) => course.id);
    }

    const membership = await classMembershipRepository.create(
      {
        studentId,
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

    const currentYear = await academicYearRepository.findCurrent();
    if (!currentYear) {
      throw new ApiError(404, 'No current academic year is set');
    }
    if (membership.academicYearId === currentYear.id) {
      throw new ApiError(400, 'This membership is already for the current academic year');
    }

    if (outcome === 'graduated') {
      await userRepository.updateStatus(membership.studentId, 'graduated');
      // Existence just confirmed above in the same request — safe to assert non-null.
      const updated = await classMembershipRepository.setOutcome(id, 'graduated', null);
      return ok(res, serializeClassMembership(updated!), 'Student graduated', 201);
    }

    if (!targetSectionId) {
      throw new ApiError(400, 'targetSectionId is required for promoted/retained');
    }

    const targetSection = await sectionRepository.findById(targetSectionId);
    if (!targetSection) {
      throw new ApiError(404, 'Target section not found');
    }

    const cls = await classRepository.findById(targetSection.classId);
    // Section.classId is FK-enforced against Classes — a missing class here would mean the
    // DB is in an inconsistent state, not a normal 404 case, so let it surface as a 500.
    const program = await programRepository.findById(cls!.programId);

    let autoEnrollCourseIds: string[] = [];
    if (program?.institutionType === 'school') {
      const courses = await courseRepository.findAll({ classId: targetSection.classId });
      autoEnrollCourseIds = courses.map((course) => course.id);
    }

    const newMembership = await classMembershipRepository.create(
      {
        studentId: membership.studentId,
        sectionId: targetSectionId,
        academicYearId: currentYear.id,
      },
      autoEnrollCourseIds,
    );

    await classMembershipRepository.setOutcome(id, outcome, newMembership.id);

    return ok(res, serializeClassMembership(newMembership), 'Outcome recorded', 201);
  },
);
