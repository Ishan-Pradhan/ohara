import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { userRepository } from '../repositories/users.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { serializeStudentPlacement } from '../serializers/students.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getStudentPlacement = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId } = req.validated?.params as { studentId: string };

    const student = await userRepository.findById(studentId);
    if (!student || student.role !== 'student') {
      throw new ApiError(404, 'Student not found');
    }

    const currentYear = await academicYearRepository.findCurrent();
    if (!currentYear) {
      throw new ApiError(404, 'No current academic year is set');
    }

    const membership = await classMembershipRepository.findCurrentWithDetails(
      studentId,
      currentYear.id,
    );
    if (!membership) {
      throw new ApiError(404, 'Student is not placed for the current academic year');
    }

    const enrollments = await enrollmentRepository.findActiveWithDetails(
      studentId,
      currentYear.id,
    );

    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized request');
    }

    const isAdmin = user.role === 'admin';
    const isSelf = user.id === studentId;
    const isTeachingTeacher =
      user.role === 'teacher' &&
      enrollments.some((enrollment) =>
        (enrollment.course?.teachers ?? []).some((teacher) => teacher.id === user.id),
      );

    if (!isAdmin && !isSelf && !isTeachingTeacher) {
      throw new ApiError(403, "Not authorized to view this student's placement");
    }

    return ok(
      res,
      serializeStudentPlacement(membership, enrollments),
      'Student placement retrieved',
    );
  },
);
