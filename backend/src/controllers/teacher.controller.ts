import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type { User } from '../models/users.model.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { serializeCourse, serializeSection } from '../serializers/institution.serializer.js';
import { serializeRosterStudent } from '../serializers/user.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// ── MY COURSES ────────────────────────────────────────────────────────────

export const listMyCourses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const assignments = await courseTeacherRepository.findByTeacherId(teacherId);
  const courses = assignments
    .map((a) => a.course)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(serializeCourse);
  return ok(res, courses, 'Courses retrieved');
});

// requireCourseTeacher already guards this route (admin or the assigned teacher).
export const listCourseStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { courseId } = req.validated?.params as { courseId: string };
  const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
  const students = enrollments
    .map((e) => e.student)
    .filter((s): s is User => Boolean(s))
    .map(serializeRosterStudent);
  return ok(res, students, 'Roster retrieved');
});

// ── MY SECTION (class teacher only) ─────────────────────────────────────────

export const getMySection = asyncHandler(async (req: AuthRequest, res: Response) => {
  const teacherId = req.user!.id;
  const sections = await sectionRepository.findByClassTeacherId(teacherId);
  return ok(res, sections.map(serializeSection), 'Section retrieved');
});

export const listSectionStudents = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { sectionId } = req.validated?.params as { sectionId: string };
  const user = req.user!;

  const section = await sectionRepository.findById(sectionId);
  if (!section) {
    throw new ApiError(404, 'Section not found');
  }
  if (user.role !== 'admin' && section.classTeacherId !== user.id) {
    throw new ApiError(403, 'Not authorized for this section');
  }

  const memberships = await classMembershipRepository.findBySectionWithStudents(sectionId);
  const students = memberships
    .map((m) => m.student)
    .filter((s): s is User => Boolean(s))
    .map(serializeRosterStudent);
  return ok(res, students, 'Roster retrieved');
});
