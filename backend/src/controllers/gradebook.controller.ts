import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { questionRepository } from '../repositories/questions.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { quizAnswerGradeRepository } from '../repositories/quizAnswerGrades.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { buildGradebook } from '../serializers/gradebook.serializer.js';
import { QUIZ_STATUS, QUESTION_TYPES, GRADE_STATUS } from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/** Gathers every input buildGradebook needs, then hands off to that pure
 * function — this is the only place that queries the DB for the gradebook. */
const loadGradebook = async (courseId: string) => {
  const [assignments, quizzes, roster] = await Promise.all([
    assignmentRepository.findAllByCourse(courseId),
    quizRepository.findAllByCourse(courseId, QUIZ_STATUS.PUBLISHED),
    enrollmentRepository.findByCourseWithStudents(courseId),
  ]);

  const assignmentInputs = await Promise.all(
    assignments.map(async (assignment) => ({
      id: assignment.id,
      title: assignment.title,
      rubric: assignment.rubric,
      submissions: await submissionRepository.findAllByAssignment(assignment.id),
    })),
  );

  const quizInputs = await Promise.all(
    quizzes.map(async (quiz) => {
      const questions = await questionRepository.findAllByQuiz(quiz.id);
      // Every question's points, MCQ and short-answer alike — matches
      // quiz_attempts.maxScore (see quizAttempts.controller.ts), which every
      // per-student cell below is read from.
      const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
      const shortAnswerQuestionIds = new Set(
        questions.filter((q) => q.type === QUESTION_TYPES.SHORT_ANSWER).map((q) => q.id),
      );

      const rawAttempts = await quizAttemptRepository.findAllByQuiz(quiz.id);
      const attempts = await Promise.all(
        rawAttempts.map(async (attempt) => {
          let hasPendingShortAnswer = false;
          if (shortAnswerQuestionIds.size > 0) {
            const answerGrades = await quizAnswerGradeRepository.findByAttempt(attempt.id);
            const approvedIds = new Set(
              answerGrades.filter((g) => g.status === GRADE_STATUS.APPROVED).map((g) => g.questionId),
            );
            hasPendingShortAnswer = attempt.responses.some(
              (r) => shortAnswerQuestionIds.has(r.questionId) && !approvedIds.has(r.questionId),
            );
          }
          return { attempt, hasPendingShortAnswer };
        }),
      );

      return { id: quiz.id, title: quiz.title, maxScore, attempts };
    }),
  );

  const rosterInputs = roster.map((enrollment) => ({
    studentId: enrollment.studentId,
    studentName: enrollment.student?.name ?? 'Unknown student',
  }));

  return buildGradebook(assignmentInputs, quizInputs, rosterInputs);
};

export const getGradebook = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const gradebook = await loadGradebook(courseId);
    return ok(res, gradebook, 'Gradebook retrieved');
  },
);

export const getMyGrades = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId } = req.validated?.params as { courseId: string };
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const gradebook = await loadGradebook(courseId);
    const row = gradebook.rows.find((r) => r.studentId === studentId) ?? null;
    return ok(res, row, 'Grades retrieved');
  },
);
