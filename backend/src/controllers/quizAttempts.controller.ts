import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { quizAnswerGradeRepository } from '../repositories/quizAnswerGrades.repository.js';
import { notificationRepository } from '../repositories/notifications.repository.js';
import {
  serializeQuizAttempt,
  serializeQuizAttemptForStudent,
} from '../serializers/quizAttempts.serializer.js';
import { generateJson } from '../services/llm.service.js';
import {
  shortAnswerGradingSystemPrompt,
  shortAnswerGradingUserPrompt,
  shortAnswerGradingCorrectivePrompt,
} from '../prompts/shortAnswerGrading.prompt.js';
import { gradedShortAnswerSchema } from '../validations/quizAttempts.validation.js';
import { QUIZ_STATUS, QUESTION_TYPES, GRADE_STATUS } from '../constants/index.js';
import type { QuizResponse } from '../types/quizAttempts.types.js';
import type { Question } from '../models/questions.model.js';
import type { QuizAttempt } from '../models/quizAttempts.model.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const findPublishedQuiz = async (courseId: string, id: string) => {
  const quiz = await quizRepository.findById(id, true);
  if (!quiz || quiz.courseId !== courseId || quiz.status !== QUIZ_STATUS.PUBLISHED) {
    throw new ApiError(404, 'Quiz not found');
  }
  return quiz;
};

/** Score from MCQ responses only — short-answer contributes 0 here, added in
 * separately once (and if) a grade is approved. Shared between submission
 * time and recomputeAttemptScore below so the two never drift apart. */
const computeMcqScore = (responses: QuizResponse[], questions: Question[]): number => {
  const questionsById = new Map(questions.map((q) => [q.id, q]));
  let score = 0;
  for (const response of responses) {
    const question = questionsById.get(response.questionId);
    if (question?.type === QUESTION_TYPES.MCQ && question.answer?.correctIndex === response.answer) {
      score += question.points;
    }
  }
  return score;
};

export const submitAttempt = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: quizId } = req.validated?.params as { courseId: string; id: string };
    const { responses } = req.validated?.body as { responses: QuizResponse[] };
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const quiz = await findPublishedQuiz(courseId, quizId);
    const questions = quiz.questions ?? [];

    const existing = await quizAttemptRepository.findByQuizAndStudent(quizId, studentId);
    if (existing) {
      throw new ApiError(409, 'This student has already attempted this quiz');
    }

    const questionIds = new Set(questions.map((q) => q.id));
    for (const response of responses) {
      if (!questionIds.has(response.questionId)) {
        throw new ApiError(400, `Question ${response.questionId} is not on this quiz`);
      }
    }

    // maxScore is every question's points, MCQ and short-answer alike — it's
    // fixed the moment the attempt exists. score starts as MCQ-only; a
    // short-answer's points arrive later via recomputeAttemptScore, once
    // (and if) a teacher approves an AI grade for it.
    const score = computeMcqScore(responses, questions);
    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);

    const attempt = await quizAttemptRepository.create({
      quizId,
      studentId,
      responses,
      score,
      maxScore,
      submittedAt: new Date(),
    });

    return ok(res, serializeQuizAttemptForStudent(attempt, questions, []), 'Attempt scored', 201);
  },
);

export const getMyAttempt = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: quizId } = req.validated?.params as { courseId: string; id: string };
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const quiz = await quizRepository.findById(quizId, true);
    if (!quiz || quiz.courseId !== courseId) {
      throw new ApiError(404, 'Quiz not found');
    }

    const attempt = await quizAttemptRepository.findByQuizAndStudent(quizId, studentId);
    if (!attempt) {
      return ok(res, null, 'Attempt retrieved');
    }
    const answerGrades = await quizAnswerGradeRepository.findByAttempt(attempt.id);
    return ok(
      res,
      serializeQuizAttemptForStudent(attempt, quiz.questions ?? [], answerGrades),
      'Attempt retrieved',
    );
  },
);

export const listAttempts = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: quizId } = req.validated?.params as { courseId: string; id: string };

    const quiz = await quizRepository.findById(quizId, true);
    if (!quiz || quiz.courseId !== courseId) {
      throw new ApiError(404, 'Quiz not found');
    }

    const attempts = await quizAttemptRepository.findAllByQuiz(quizId);
    const serialized = await Promise.all(
      attempts.map(async (attempt) => {
        const answerGrades = await quizAnswerGradeRepository.findByAttempt(attempt.id);
        return serializeQuizAttempt(attempt, quiz.questions ?? [], answerGrades);
      }),
    );
    return ok(res, serialized, 'Attempts retrieved');
  },
);

// ── Short-answer AI grading ─────────────────────────────────────────────────

const findOwnedAttempt = async (quizId: string, attemptId: string): Promise<QuizAttempt> => {
  const attempt = await quizAttemptRepository.findById(attemptId);
  if (!attempt || attempt.quizId !== quizId) {
    throw new ApiError(404, 'Attempt not found');
  }
  return attempt;
};

const findOwnedShortAnswerQuestion = (questions: Question[], questionId: string): Question => {
  const question = questions.find((q) => q.id === questionId);
  if (!question || question.type !== QUESTION_TYPES.SHORT_ANSWER) {
    throw new ApiError(404, 'Short-answer question not found on this quiz');
  }
  return question;
};

/** Recomputes and persists the attempt's total score: MCQ (unchanged once
 * submitted) plus every APPROVED short-answer grade. Called after any grade
 * create/update so quiz_attempts.score stays the single source of truth
 * every read path (including the gradebook) already relies on. */
const recomputeAttemptScore = async (attempt: QuizAttempt, questions: Question[]): Promise<void> => {
  const mcqScore = computeMcqScore(attempt.responses, questions);
  const answerGrades = await quizAnswerGradeRepository.findByAttempt(attempt.id);
  const approvedShortAnswerScore = answerGrades
    .filter((g) => g.status === GRADE_STATUS.APPROVED)
    .reduce((sum, g) => sum + Number(g.awardedPoints), 0);
  await quizAttemptRepository.update(attempt.id, { score: mcqScore + approvedShortAnswerScore });
};

const tryParseGradedAnswer = (raw: string) => {
  try {
    const json: unknown = JSON.parse(raw);
    return gradedShortAnswerSchema.safeParse(json);
  } catch {
    return { success: false as const };
  }
};

/** Grades one short-answer response via the LLM — draft only (golden rule
 * 6). Clamps awardedPoints to the question's own points, never trusting the
 * model's arithmetic, same principle as assignment grading. */
const gradeOneShortAnswer = async (
  quizId: string,
  courseId: string,
  attemptId: string,
  questionId: string,
) => {
  // No publish-status check here, unlike submitAttempt — a teacher must
  // still be able to grade attempts collected before they unpublished a
  // quiz.
  const quiz = await quizRepository.findById(quizId, true);
  if (!quiz || quiz.courseId !== courseId) {
    throw new ApiError(404, 'Quiz not found');
  }
  const attempt = await findOwnedAttempt(quizId, attemptId);
  const question = findOwnedShortAnswerQuestion(quiz.questions ?? [], questionId);
  const response = attempt.responses.find((r) => r.questionId === questionId);
  if (!response) {
    throw new ApiError(400, 'This student did not answer that question');
  }

  const existingGrade = await quizAnswerGradeRepository.findByAttemptAndQuestion(attemptId, questionId);
  if (existingGrade?.status === GRADE_STATUS.APPROVED) {
    throw new ApiError(409, 'Grade is already approved');
  }

  const userPrompt = shortAnswerGradingUserPrompt(question.prompt, question.points, String(response.answer));
  const raw = await generateJson(shortAnswerGradingSystemPrompt, userPrompt);

  let parsed = tryParseGradedAnswer(raw);
  if (!parsed.success) {
    const retryRaw = await generateJson(
      shortAnswerGradingSystemPrompt,
      shortAnswerGradingCorrectivePrompt(raw),
    );
    parsed = tryParseGradedAnswer(retryRaw);
  }
  if (!parsed.success) {
    throw new ApiError(502, 'The LLM could not produce a valid grade after a retry');
  }

  const awardedPoints = Math.min(Math.max(parsed.data.awardedPoints, 0), question.points);

  if (existingGrade) {
    await quizAnswerGradeRepository.deleteByAttemptAndQuestion(attemptId, questionId);
  }
  const grade = await quizAnswerGradeRepository.create({
    attemptId,
    questionId,
    awardedPoints,
    maxPoints: question.points,
    feedback: parsed.data.feedback,
    status: GRADE_STATUS.DRAFT,
  });

  await recomputeAttemptScore(attempt, quiz.questions ?? []);
  return grade;
};

export const gradeShortAnswer = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: quizId, attemptId, questionId } = req.validated?.params as {
      courseId: string;
      id: string;
      attemptId: string;
      questionId: string;
    };
    const grade = await gradeOneShortAnswer(quizId, courseId, attemptId, questionId);
    return ok(res, {
      id: grade.id,
      questionId: grade.questionId,
      awardedPoints: Number(grade.awardedPoints),
      maxPoints: Number(grade.maxPoints),
      feedback: grade.feedback,
      status: grade.status,
    }, 'Draft grade generated');
  },
);

export const gradeAllShortAnswers = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: quizId } = req.validated?.params as { courseId: string; id: string };

    const quiz = await quizRepository.findById(quizId, true);
    if (!quiz || quiz.courseId !== courseId) {
      throw new ApiError(404, 'Quiz not found');
    }
    const shortAnswerQuestionIds = new Set(
      (quiz.questions ?? []).filter((q) => q.type === QUESTION_TYPES.SHORT_ANSWER).map((q) => q.id),
    );

    const attempts = await quizAttemptRepository.findAllByQuiz(quizId);

    const toGrade: { attemptId: string; questionId: string }[] = [];
    for (const attempt of attempts) {
      const existingGrades = await quizAnswerGradeRepository.findByAttempt(attempt.id);
      const gradedQuestionIds = new Set(existingGrades.map((g) => g.questionId));
      for (const response of attempt.responses) {
        if (shortAnswerQuestionIds.has(response.questionId) && !gradedQuestionIds.has(response.questionId)) {
          toGrade.push({ attemptId: attempt.id, questionId: response.questionId });
        }
      }
    }

    let graded = 0;
    const errors: { attemptId: string; questionId: string; error: string }[] = [];
    for (const { attemptId, questionId } of toGrade) {
      try {
        await gradeOneShortAnswer(quizId, courseId, attemptId, questionId);
        graded += 1;
      } catch (err) {
        logger.warn({ err, attemptId, questionId }, 'Short-answer grading failed during grade-all');
        errors.push({
          attemptId,
          questionId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return ok(
      res,
      { total: toGrade.length, graded, failed: errors.length, errors },
      'Batch grading complete',
    );
  },
);

export const editShortAnswerGrade = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: quizId, attemptId, questionId } = req.validated?.params as {
      courseId: string;
      id: string;
      attemptId: string;
      questionId: string;
    };
    const body = req.validated?.body as {
      awardedPoints: number;
      feedback?: string | null;
      status?: 'draft' | 'approved';
    };
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const quiz = await quizRepository.findById(quizId, true);
    if (!quiz || quiz.courseId !== courseId) {
      throw new ApiError(404, 'Quiz not found');
    }
    const attempt = await findOwnedAttempt(quizId, attemptId);
    const question = findOwnedShortAnswerQuestion(quiz.questions ?? [], questionId);

    const existingGrade = await quizAnswerGradeRepository.findByAttemptAndQuestion(attemptId, questionId);
    if (!existingGrade) {
      throw new ApiError(404, 'No grade exists yet for this response — run AI grading first');
    }

    const status = body.status ?? existingGrade.status;
    const grade = await quizAnswerGradeRepository.update(existingGrade.id, {
      awardedPoints: Math.min(Math.max(body.awardedPoints, 0), question.points),
      feedback: body.feedback ?? existingGrade.feedback,
      status,
      approvedBy: status === GRADE_STATUS.APPROVED ? teacherId : null,
    });
    if (!grade) {
      throw new ApiError(404, 'Grade not found');
    }

    await recomputeAttemptScore(attempt, quiz.questions ?? []);

    if (existingGrade.status !== GRADE_STATUS.APPROVED && grade.status === GRADE_STATUS.APPROVED) {
      await notificationRepository.create({
        userId: attempt.studentId,
        type: 'quiz_graded',
        title: `Quiz answer graded: ${quiz.title}`,
        body: `Score: ${Number(grade.awardedPoints)}/${Number(grade.maxPoints)} on one question`,
        link: `/student/courses/${courseId}/quizzes/${quizId}`,
      });
    }

    return ok(res, {
      id: grade.id,
      questionId: grade.questionId,
      awardedPoints: Number(grade.awardedPoints),
      maxPoints: Number(grade.maxPoints),
      feedback: grade.feedback,
      status: grade.status,
    }, 'Grade updated');
  },
);
