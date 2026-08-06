import type { QuizAttempt } from '../models/quizAttempts.model.js';
import type { Question } from '../models/questions.model.js';
import type { QuizAnswerGrade } from '../models/quizAnswerGrades.model.js';
import { QUESTION_TYPES, GRADE_STATUS } from '../constants/index.js';

/** Not stored — recomputed from the quiz's current question definitions each
 * time an attempt is read, so a later question edit doesn't require a
 * migration of past attempts. The attempt is already submitted, so revealing
 * the correct MCQ answer here has learning value and no integrity risk.
 *
 * `answerGrades` are this attempt's short-answer grades (see
 * quizAnswerGrades.model.ts) — MCQ has none. `attempt.score`/`maxScore`
 * themselves are read straight from the row: maxScore is fixed at
 * submission (every question's points), and score is kept in sync by
 * quizAttempts.controller.ts's recomputeAttemptScore whenever a short-answer
 * grade is approved, so this serializer never has to recompute totals
 * itself — one source of truth, shared with the gradebook.
 *
 * Teacher/admin always see the draft AI grade so they can review it; a
 * student never does until it's approved (golden rule 6) — see
 * serializeQuizAttemptForStudent below. */
export const serializeQuizAttempt = (
  attempt: QuizAttempt,
  questions: Question[],
  answerGrades: QuizAnswerGrade[] = [],
) => {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const gradeByQuestionId = new Map(answerGrades.map((g) => [g.questionId, g]));

  const results = attempt.responses.map((response) => {
    const question = questionById.get(response.questionId);
    const isMcq = question?.type === QUESTION_TYPES.MCQ;
    const grade = gradeByQuestionId.get(response.questionId);
    return {
      questionId: response.questionId,
      type: question?.type ?? null,
      answer: response.answer,
      correct: isMcq ? question?.answer?.correctIndex === response.answer : null,
      correctIndex: isMcq ? (question?.answer?.correctIndex ?? null) : null,
      points: question?.points ?? 0,
      grade: !isMcq
        ? {
            status: grade?.status ?? 'ungraded',
            awardedPoints: grade ? Number(grade.awardedPoints) : null,
            maxPoints: grade ? Number(grade.maxPoints) : (question?.points ?? null),
            feedback: grade?.feedback ?? null,
          }
        : null,
    };
  });

  return {
    id: attempt.id,
    quizId: attempt.quizId,
    studentId: attempt.studentId,
    student: attempt.student
      ? { id: attempt.student.id, name: attempt.student.name, email: attempt.student.email }
      : undefined,
    score: Number(attempt.score),
    maxScore: Number(attempt.maxScore),
    submittedAt: attempt.submittedAt,
    results,
  };
};

/** A student never sees a draft short-answer grade — only an approved one
 * (same principle as assignments' serializeSubmissionForStudent). */
export const serializeQuizAttemptForStudent = (
  attempt: QuizAttempt,
  questions: Question[],
  answerGrades: QuizAnswerGrade[] = [],
) => {
  const full = serializeQuizAttempt(attempt, questions, answerGrades);
  return {
    ...full,
    results: full.results.map((result) =>
      result.grade && result.grade.status !== GRADE_STATUS.APPROVED
        ? { ...result, grade: { status: result.grade.status, awardedPoints: null, maxPoints: result.grade.maxPoints, feedback: null } }
        : result,
    ),
  };
};
