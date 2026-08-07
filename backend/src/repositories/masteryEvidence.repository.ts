import { Op } from 'sequelize';

import { Quiz } from '../models/quizzes.model.js';
import { Question } from '../models/questions.model.js';
import { QuizAttempt } from '../models/quizAttempts.model.js';
import { Assignment } from '../models/assignments.model.js';
import { Submission } from '../models/submissions.model.js';
import { Grade } from '../models/grades.model.js';
import { QUIZ_STATUS, QUESTION_TYPES, GRADE_STATUS } from '../constants/index.js';

// ──────────────────────────────────────────────────────────────────────────────
// Output shapes
// ──────────────────────────────────────────────────────────────────────────────

export interface QuestionCorrectnessRecord {
  questionId: string;
  /** The question prompt text — shown verbatim to the student. */
  prompt: string;
  /** Number of times the student answered this MCQ question. */
  attempts: number;
  /** Number of times the student answered correctly. */
  correct: number;
  /** correct / attempts, or null when attempts === 0. */
  correctRate: number | null;
}

export interface CriterionWeaknessRecord {
  criterion: string;
  /** Sum of awarded points across all approved grades for this criterion. */
  totalAwarded: number;
  /** Sum of max points across the same grades. */
  totalMax: number;
  /** totalAwarded / totalMax, or null when totalMax === 0. */
  scoreRate: number | null;
}

export interface CourseMasteryEvidence {
  courseId: string;
  courseTitle: string;
  /** Per-question correctness for every MCQ the student has attempted. */
  questionCorrectness: QuestionCorrectnessRecord[];
  /** Per-criterion performance across all approved assignment grades. */
  criterionWeakness: CriterionWeaknessRecord[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Repository
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetches per-question MCQ correctness and per-criterion assignment weakness
 * for a student across a list of enrolled courses.
 *
 * MCQ correctness: compares each response in QuizAttempt.responses against
 * Question.answer.correctIndex — no extra table needed.
 *
 * Criterion weakness: reads approved Grade.criterionFeedback entries.
 *
 * No schema changes required.
 */
export const masteryEvidenceRepository = {
  findForStudent: async (
    studentId: string,
    enrolledCourses: ReadonlyArray<{ courseId: string; courseTitle: string }>,
  ): Promise<CourseMasteryEvidence[]> => {
    return Promise.all(
      enrolledCourses.map(async ({ courseId, courseTitle }) => {
        // ── 1. MCQ correctness ────────────────────────────────────────────────
        const quizzes = await Quiz.findAll({
          where: { courseId, status: QUIZ_STATUS.PUBLISHED },
          attributes: ['id'],
        });

        // Accumulate per-question correct / attempt counts
        const questionMap = new Map<
          string,
          { prompt: string; attempts: number; correct: number }
        >();

        if (quizzes.length > 0) {
          const quizIds = quizzes.map((q) => q.id);

          // Load all MCQ questions for these quizzes in one query
          const questions = await Question.findAll({
            where: {
              quizId: { [Op.in]: quizIds },
              type: QUESTION_TYPES.MCQ,
            },
            attributes: ['id', 'prompt', 'answer'],
          });

          // Build a lookup: questionId → correctIndex
          const correctIndexById = new Map<string, number>();
          for (const question of questions) {
            if (question.answer !== null) {
              correctIndexById.set(question.id, question.answer.correctIndex);
              questionMap.set(question.id, {
                prompt: question.prompt,
                attempts: 0,
                correct: 0,
              });
            }
          }

          if (correctIndexById.size > 0) {
            // Load all of this student's attempts for these quizzes
            const attempts = await QuizAttempt.findAll({
              where: { studentId, quizId: { [Op.in]: quizIds } },
              attributes: ['responses'],
            });

            for (const attempt of attempts) {
              for (const response of attempt.responses) {
                const correctIndex = correctIndexById.get(response.questionId);
                if (correctIndex === undefined) continue; // not an MCQ we know about

                const record = questionMap.get(response.questionId);
                if (!record) continue;

                record.attempts += 1;
                if (response.answer === correctIndex) {
                  record.correct += 1;
                }
              }
            }
          }
        }

        const questionCorrectness: QuestionCorrectnessRecord[] = Array.from(
          questionMap.entries(),
        ).map(([questionId, rec]) => ({
          questionId,
          prompt: rec.prompt,
          attempts: rec.attempts,
          correct: rec.correct,
          correctRate: rec.attempts > 0 ? rec.correct / rec.attempts : null,
        }));

        // ── 2. Assignment criterion weakness ──────────────────────────────────
        const assignments = await Assignment.findAll({
          where: { courseId },
          attributes: ['id'],
        });

        const criterionMap = new Map<
          string,
          { totalAwarded: number; totalMax: number }
        >();

        if (assignments.length > 0) {
          const assignmentIds = assignments.map((a) => a.id);

          // Find all approved submissions by this student for these assignments
          const submissions = await Submission.findAll({
            where: {
              assignmentId: { [Op.in]: assignmentIds },
              studentId,
            },
            attributes: ['id'],
          });

          if (submissions.length > 0) {
            const submissionIds = submissions.map((s) => s.id);

            const grades = await Grade.findAll({
              where: {
                submissionId: { [Op.in]: submissionIds },
                status: GRADE_STATUS.APPROVED,
              },
              attributes: ['criterionFeedback'],
            });

            for (const grade of grades) {
              for (const cf of grade.criterionFeedback) {
                const existing = criterionMap.get(cf.criterion);
                if (existing) {
                  existing.totalAwarded += cf.awardedPoints;
                  existing.totalMax += cf.maxPoints;
                } else {
                  criterionMap.set(cf.criterion, {
                    totalAwarded: cf.awardedPoints,
                    totalMax: cf.maxPoints,
                  });
                }
              }
            }
          }
        }

        const criterionWeakness: CriterionWeaknessRecord[] = Array.from(
          criterionMap.entries(),
        ).map(([criterion, rec]) => ({
          criterion,
          totalAwarded: rec.totalAwarded,
          totalMax: rec.totalMax,
          scoreRate: rec.totalMax > 0 ? rec.totalAwarded / rec.totalMax : null,
        }));

        return { courseId, courseTitle, questionCorrectness, criterionWeakness };
      }),
    );
  },
};
