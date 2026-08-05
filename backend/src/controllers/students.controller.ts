import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { userRepository } from '../repositories/users.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { serializeStudentPlacement } from '../serializers/students.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getStudentPlacement = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { studentId } = req.validated?.params as { studentId: string };

    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized request');
    }

    const isAdmin = user.role === 'admin';
    const isSelf = user.id === studentId;

    if (!isAdmin && !isSelf && user.role !== 'teacher') {
      throw new ApiError(403, "Not authorized to view this student's placement");
    }

    const student = await userRepository.findById(studentId);
    if (!student || student.role !== 'student') {
      throw new ApiError(404, 'Student not found');
    }

    const membership = await classMembershipRepository.findCurrent(studentId);
    if (!membership) {
      throw new ApiError(404, 'Student is not currently placed');
    }

    const enrollments = await enrollmentRepository.findActiveWithDetails(
      studentId,
      membership.academicYearId,
    );

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
