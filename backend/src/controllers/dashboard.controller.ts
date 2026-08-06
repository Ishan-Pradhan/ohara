import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { notificationRepository } from '../repositories/notifications.repository.js';
import { buildStudentDashboard } from '../serializers/dashboard.serializer.js';
import { QUIZ_STATUS } from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getStudentDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const membership = await classMembershipRepository.findCurrent(studentId);
    if (!membership) {
      const unreadNotificationCount = await notificationRepository.countUnread(studentId);
      return ok(
        res,
        { placed: false, courses: [], upcoming: [], recentGrades: [], unreadNotificationCount },
        'Dashboard retrieved',
      );
    }

    const enrollments = await enrollmentRepository.findActiveWithDetails(
      studentId,
      membership.academicYearId,
    );

    const [courseAssignments, courseQuizzes, unreadNotificationCount] = await Promise.all([
      Promise.all(
        enrollments.map(async (enrollment) => {
          const assignments = await assignmentRepository.findAllByCourse(enrollment.courseId);
          const submissionsByAssignmentId = new Map(
            await Promise.all(
              assignments.map(async (a) => {
                const submission = await submissionRepository.findByAssignmentAndStudent(a.id, studentId);
                return [a.id, submission] as const;
              }),
            ),
          );
          return {
            courseId: enrollment.courseId,
            courseTitle: enrollment.course?.title ?? '',
            assignments,
            submissionsByAssignmentId,
          };
        }),
      ),
      Promise.all(
        enrollments.map(async (enrollment) => {
          const quizzes = await quizRepository.findAllByCourse(enrollment.courseId, QUIZ_STATUS.PUBLISHED);
          const attemptsByQuizId = new Map(
            await Promise.all(
              quizzes.map(async (q) => {
                const attempt = await quizAttemptRepository.findByQuizAndStudent(q.id, studentId);
                return [q.id, attempt] as const;
              }),
            ),
          );
          return {
            courseId: enrollment.courseId,
            courseTitle: enrollment.course?.title ?? '',
            quizzes,
            attemptsByQuizId,
          };
        }),
      ),
      notificationRepository.countUnread(studentId),
    ]);

    const dashboard = buildStudentDashboard(
      enrollments,
      courseAssignments,
      courseQuizzes,
      unreadNotificationCount,
    );

    return ok(res, { placed: true, ...dashboard }, 'Dashboard retrieved');
  },
);
