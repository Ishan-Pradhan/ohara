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
import { resolveCurrentBatchForCourseOrNull, resolveBatchForCourse } from './courses.controller.js';
import { QUIZ_STATUS, QUESTION_TYPES, GRADE_STATUS } from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/** Gathers every input buildGradebook needs, then hands off to that pure
 * function — this is the only place that queries the DB for the gradebook.
 * Scoped to one batch: a Course is reused by every future batch reaching its
 * Class, so without this a batch's gradebook would include other batches'
 * assignments/quizzes too. `batchId` omitted -> the course's *current* batch
 * (unchanged default behavior; no batch resolved yet just means an empty
 * gradebook, not an error — a course with no one in it yet is a normal
 * state to view). `batchId` given -> that specific batch's gradebook, past
 * or present — the roster comes from that batch's own enrollments (any
 * status), not just 'active', since a past batch is by definition no longer
 * active. See docs/superpowers/specs/2026-08-13-completed-course-history-design.md. */
export const loadGradebook = async (courseId: string, batchId?: string) => {
  const batch = batchId
    ? await resolveBatchForCourse(courseId, batchId)
    : await resolveCurrentBatchForCourseOrNull(courseId);
  const [assignments, quizzes, roster] = await Promise.all([
    batch ? assignmentRepository.findAllByCourse(courseId, batch.id) : Promise.resolve([]),
    batch ? quizRepository.findAllByCourse(courseId, batch.id, QUIZ_STATUS.PUBLISHED) : Promise.resolve([]),
    batchId
      ? enrollmentRepository.findByCourseAndBatchWithStudents(courseId, batchId)
      : enrollmentRepository.findByCourseWithStudents(courseId),
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
    const { batchId } = (req.validated?.query as { batchId?: string }) ?? {};
    const gradebook = await loadGradebook(courseId, batchId);
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

    // A student's own batch for this course — not "whichever batch is
    // currently enrolled," which would be wrong once this student has been
    // promoted out and a newer batch has taken their place in the course.
    const [enrollment] = await enrollmentRepository.findAll({ studentId, courseId });
    if (!enrollment) {
      throw new ApiError(404, 'Not enrolled in this course');
    }

    const gradebook = await loadGradebook(courseId, enrollment.batchId);
    const row = gradebook.rows.find((r) => r.studentId === studentId) ?? null;
    return ok(res, row, 'Grades retrieved');
  },
);
