import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { resolveCurrentAcademicYearForCourse } from './courses.controller.js';
import { QUIZ_STATUS } from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';

interface GradeTrendPoint {
  date: string;
  score: number;
  maxScore: number;
  title: string;
  type: 'assignment' | 'quiz';
}

export const getGradeTrends = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };

    const academicYear = await resolveCurrentAcademicYearForCourse(courseId);
    const [assignments, quizzes] = await Promise.all([
      assignmentRepository.findAllByCourse(courseId, academicYear.id),
      quizRepository.findAllByCourse(courseId, academicYear.id, QUIZ_STATUS.PUBLISHED),
    ]);

    const points: GradeTrendPoint[] = [];

    // Assignment grades — use Grade.updatedAt as the date (when grade was approved)
    const assignmentSubmissions = await Promise.all(
      assignments.map(async (assignment) => {
        const submissions = await submissionRepository.findAllByAssignment(assignment.id);
        return { assignment, submissions };
      }),
    );

    for (const { assignment, submissions } of assignmentSubmissions) {
      const maxScore = assignment.rubric.reduce((sum, r) => sum + r.maxPoints, 0);
      for (const submission of submissions) {
        if (submission.grade && submission.grade.status === 'approved') {
          points.push({
            date: submission.grade.updatedAt.toISOString(),
            score: submission.grade.score,
            maxScore,
            title: assignment.title,
            type: 'assignment',
          });
        }
      }
    }

    // Quiz scores — use QuizAttempt.submittedAt as the date
    const quizAttempts = await Promise.all(
      quizzes.map(async (quiz) => {
        const attempts = await quizAttemptRepository.findAllByQuiz(quiz.id);
        return { quiz, attempts };
      }),
    );

    for (const { quiz, attempts } of quizAttempts) {
      for (const attempt of attempts) {
        points.push({
          date: attempt.submittedAt.toISOString(),
          score: attempt.score,
          maxScore: attempt.maxScore,
          title: quiz.title,
          type: 'quiz',
        });
      }
    }

    // Sort by date ascending
    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return ok(res, points, 'Grade trends retrieved');
  },
);
