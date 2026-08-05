import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { serializeEnrollment } from '../serializers/placement.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const requireCurrentMembershipInCourseClass = async (studentId: string, courseId: string) => {
  const membership = await classMembershipRepository.findCurrent(studentId);
  if (!membership) {
    throw new ApiError(404, 'Student is not currently placed');
  }
  const classId = membership.section?.classId;
  if (!classId) {
    throw new ApiError(500, 'Membership is missing its section');
  }

  const course = await courseRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }
  if (course.classId !== classId) {
    throw new ApiError(403, 'This course is not part of your current semester');
  }

  return { membership, course };
};

export const enrollInElective = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const studentId = req.user!.id;

  const { membership, course } = await requireCurrentMembershipInCourseClass(studentId, courseId);

  if (course.courseType !== 'elective') {
    throw new ApiError(400, 'Only elective courses can be self-enrolled');
  }

  if (course.capacity !== null) {
    const counts = await enrollmentRepository.countByCourses([courseId]);
    if ((counts[courseId] ?? 0) >= course.capacity) {
      throw new ApiError(400, 'This elective is full');
    }
  }

  const existing = await enrollmentRepository.findByStudentCourseYear(
    studentId,
    courseId,
    membership.academicYearId,
  );

  if (existing) {
    if (existing.status === 'active') {
      throw new ApiError(400, 'Already enrolled in this course');
    }
    const reactivated = await enrollmentRepository.setStatus(existing.id, 'active');
    return ok(res, serializeEnrollment(reactivated!), 'Enrolled', 201);
  }

  const enrollment = await enrollmentRepository.create({
    studentId,
    courseId,
    academicYearId: membership.academicYearId,
  });

  return ok(res, serializeEnrollment(enrollment), 'Enrolled', 201);
});

export const dropElective = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const studentId = req.user!.id;

  const { membership, course } = await requireCurrentMembershipInCourseClass(studentId, courseId);

  if (course.courseType !== 'elective') {
    throw new ApiError(400, 'Compulsory courses cannot be dropped');
  }

  const existing = await enrollmentRepository.findByStudentCourseYear(
    studentId,
    courseId,
    membership.academicYearId,
  );
  if (!existing || existing.status !== 'active') {
    throw new ApiError(404, 'Not currently enrolled in this course');
  }

  await enrollmentRepository.setStatus(existing.id, 'dropped');

  return ok(res, null, 'Dropped');
});
