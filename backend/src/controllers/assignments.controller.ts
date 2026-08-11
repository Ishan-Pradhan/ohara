import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { notificationRepository } from '../repositories/notifications.repository.js';
import { serializeAssignment } from '../serializers/assignments.serializer.js';
import type { RubricCriterion } from '../types/assignments.types.js';
import { resolveCurrentAcademicYearForCourse } from './courses.controller.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const findOwnedAssignment = async (courseId: string, id: string) => {
  const assignment = await assignmentRepository.findById(id);
  if (!assignment || assignment.courseId !== courseId) {
    throw new ApiError(404, 'Assignment not found');
  }
  return assignment;
};

export const createAssignment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const { title, prompt, rubric, dueAt } = req.validated?.body as {
      title: string;
      prompt: string;
      rubric: RubricCriterion[];
      dueAt: string;
    };

    const academicYear = await resolveCurrentAcademicYearForCourse(courseId);
    const assignment = await assignmentRepository.create({
      courseId,
      academicYearId: academicYear.id,
      title,
      prompt,
      rubric,
      dueAt: new Date(dueAt),
    });

    const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
    await notificationRepository.bulkCreate(
      enrollments.map((e) => ({
        userId: e.studentId,
        type: 'assignment_created' as const,
        title: `New assignment: ${assignment.title}`,
        body: `Due ${assignment.dueAt.toLocaleDateString()}`,
        link: `/student/courses/${courseId}/assignments/${assignment.id}`,
      })),
    );

    return ok(res, serializeAssignment(assignment), 'Assignment created', 201);
  },
);

export const listAssignments = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const academicYear = await resolveCurrentAcademicYearForCourse(courseId);
    const assignments = await assignmentRepository.findAllByCourse(courseId, academicYear.id);
    return ok(res, assignments.map(serializeAssignment), 'Assignments retrieved');
  },
);

export const getAssignment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const assignment = await findOwnedAssignment(courseId, id);
    return ok(res, serializeAssignment(assignment), 'Assignment retrieved');
  },
);

export const updateAssignment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    const body = req.validated?.body as {
      title?: string;
      prompt?: string;
      rubric?: RubricCriterion[];
      dueAt?: string;
    };

    await findOwnedAssignment(courseId, id);

    const { dueAt, ...rest } = body;
    const assignment = await assignmentRepository.update(id, {
      ...rest,
      // Only present the key at all when a new value was actually given —
      // an explicit `dueAt: undefined` would still be treated as a change
      // by Sequelize's dirty-checking and could clobber the existing value.
      ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
    });
    if (!assignment) {
      throw new ApiError(404, 'Assignment not found');
    }
    return ok(res, serializeAssignment(assignment), 'Assignment updated');
  },
);

export const deleteAssignment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id } = req.validated?.params as { courseId: string; id: string };
    await findOwnedAssignment(courseId, id);
    await assignmentRepository.delete(id);
    return ok(res, null, 'Assignment deleted');
  },
);
