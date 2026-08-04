import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { studentFlagRepository } from '../repositories/studentFlags.repository.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { serializeStudentFlag } from '../serializers/studentFlag.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

interface CreateFlagBody {
  studentId: string;
  reason: string;
  courseId?: string;
  sectionId?: string;
}

/** Raised by a teacher from a course or section roster — not a lifecycle
 * action, just a note for admins. Ownership is checked against whichever
 * context (course or section) the flag was raised from; admins may always
 * raise one without an ownership check. */
export const createStudentFlag = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { studentId, reason, courseId, sectionId } = req.validated?.body as CreateFlagBody;
  const user = req.user!;

  const student = await userRepository.findById(studentId);
  if (!student || student.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }

  if (user.role !== 'admin') {
    if (courseId) {
      const isAssigned = await courseTeacherRepository.exists(user.id, courseId);
      if (!isAssigned) {
        throw new ApiError(403, 'Not authorized for this course');
      }
    } else if (sectionId) {
      const section = await sectionRepository.findById(sectionId);
      if (!section || section.classTeacherId !== user.id) {
        throw new ApiError(403, 'Not authorized for this section');
      }
    } else {
      throw new ApiError(400, 'courseId or sectionId is required');
    }
  }

  const flag = await studentFlagRepository.create({
    studentId,
    raisedBy: user.id,
    reason,
    courseId: courseId ?? null,
    sectionId: sectionId ?? null,
  });

  return ok(res, serializeStudentFlag(flag), 'Flag raised', 201);
});

// ── ADMIN ────────────────────────────────────────────────────────────────

export const listStudentFlags = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { studentId } = req.validated?.params as { studentId: string };
  const flags = await studentFlagRepository.findByStudentId(studentId);
  return ok(res, flags.map(serializeStudentFlag), 'Flags retrieved');
});

export const resolveStudentFlag = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.validated?.params as { id: string };
  const flag = await studentFlagRepository.resolve(id);
  if (!flag) {
    throw new ApiError(404, 'Flag not found');
  }
  return ok(res, serializeStudentFlag(flag), 'Flag resolved');
});
