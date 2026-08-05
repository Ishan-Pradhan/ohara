import type { Response } from 'express';
import type { AuthRequest } from '../types/auth.types.js';
import { inviteUser } from './admin.controller.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { batchRepository } from '../repositories/batches.repository.js';
import { studentProfileRepository } from '../repositories/studentProfiles.repository.js';
import { institutionProfileRepository } from '../repositories/institutionProfile.repository.js';
import { serializeUser } from '../serializers/user.serializer.js';
import { serializeClassMembership } from '../serializers/placement.serializer.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

interface AdmitStudentBody {
  name: string;
  email: string;
  sectionId: string;
  batchId: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  dateOfBirth?: string;
  previousSchool?: string;
  studentPhone?: string;
}

// One request bundles what used to be two manual steps: inviting the
// student (admin.controller.ts's shared inviteUser, same email mechanism as
// batch invite) and placing + auto-enrolling them (placement.controller.ts's
// pattern, duplicated here rather than imported since createClassMembership
// there is wired to its own req/res contract, not reusable as a plain
// function without a larger refactor — out of scope for this change).
export const admitStudent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    name,
    email,
    sectionId,
    batchId,
    parentName,
    parentPhone,
    address,
    dateOfBirth,
    previousSchool,
    studentPhone,
  } = req.validated?.body as AdmitStudentBody;

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

  const profile = await institutionProfileRepository.get();
  const institutionName = profile?.name ?? 'Ohara';

  const student = await inviteUser(name, email, 'student', institutionName);

  const classCourses = await courseRepository.findAll({ classId: section.classId });
  const autoEnrollCourseIds = classCourses
    .filter((course) => course.courseType === 'compulsory')
    .map((course) => course.id);

  const membership = await classMembershipRepository.create(
    {
      studentId: student.id,
      batchId,
      sectionId,
      academicYearId: section.academicYearId,
    },
    autoEnrollCourseIds,
  );

  const hasKycData = [
    parentName,
    parentPhone,
    address,
    dateOfBirth,
    previousSchool,
    studentPhone,
  ].some((v) => v !== undefined);

  if (hasKycData) {
    await studentProfileRepository.upsert(student.id, {
      parentName: parentName ?? null,
      parentPhone: parentPhone ?? null,
      address: address ?? null,
      dateOfBirth: dateOfBirth ?? null,
      previousSchool: previousSchool ?? null,
      studentPhone: studentPhone ?? null,
    });
  }

  return ok(
    res,
    { student: serializeUser(student), membership: serializeClassMembership(membership) },
    'Student admitted',
    201,
  );
});
