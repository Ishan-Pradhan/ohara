import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import type { ClassMembershipCreationAttributes } from '../types/placement.types.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { serializeClassMembership } from '../serializers/placement.serializer.js';
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

    const membership = await classMembershipRepository.create({
      studentId,
      sectionId,
      academicYearId: section.academicYearId,
    });

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
