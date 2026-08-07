import { Op } from 'sequelize';

import { Module } from '../models/modules.model.js';
import { Lesson } from '../models/lessons.model.js';
import { Quiz } from '../models/quizzes.model.js';
import { QuizAttempt } from '../models/quizAttempts.model.js';
import { QUIZ_STATUS } from '../constants/index.js';

export interface CourseConceptEvidence {
  courseId: string;
  courseTitle: string;
  /** Deduplicated, insertion-ordered list of keyTopics across all lessons. */
  topics: string[];
  quizAttempt: {
    /** Number of published quizzes in this course. */
    quizCount: number;
    /** Number of quizzes the student has attempted. */
    attemptedCount: number;
    /**
     * Average score percentage across all attempts (null when no attempts).
     * This is the indirect mastery signal — questions are not tagged to topics,
     * so course-level quiz performance is used as a proxy.
     */
    averageScorePercentage: number | null;
  };
}

/**
 * Fetches the full concept evidence set for a student across enrolled courses.
 * For each course:
 *   1. Loads Modules → Lessons eagerly (one query per course) to collect keyTopics.
 *   2. Loads Quizzes (published) and the student's QuizAttempts for those quizzes.
 *
 * No schema changes needed — all data comes from existing tables.
 */
export const conceptEvidenceRepository = {
  findForStudent: async (
    studentId: string,
    enrolledCourses: ReadonlyArray<{ courseId: string; courseTitle: string }>,
  ): Promise<CourseConceptEvidence[]> => {
    return Promise.all(
      enrolledCourses.map(async ({ courseId, courseTitle }) => {
        // --- 1. Collect keyTopics from all lessons in this course ---
        const modules = await Module.findAll({
          where: { courseId },
          include: [{ model: Lesson, as: 'lessons' }],
          order: [
            ['orderIndex', 'ASC'],
            [{ model: Lesson, as: 'lessons' }, 'orderIndex', 'ASC'],
          ],
        });

        const topicSet = new Set<string>();
        for (const mod of modules) {
          for (const lesson of mod.lessons ?? []) {
            for (const topic of lesson.keyTopics) {
              const trimmed = topic.trim();
              if (trimmed) topicSet.add(trimmed);
            }
          }
        }
        const topics = Array.from(topicSet);

        // --- 2. Quiz performance for this student in this course ---
        const quizzes = await Quiz.findAll({
          where: { courseId, status: QUIZ_STATUS.PUBLISHED },
          attributes: ['id'],
        });

        const quizCount = quizzes.length;
        let attemptedCount = 0;
        let totalScore = 0;
        let totalMaxScore = 0;

        if (quizCount > 0) {
          const quizIds = quizzes.map((q) => q.id);
          const attempts = await QuizAttempt.findAll({
            where: { studentId, quizId: { [Op.in]: quizIds } },
            attributes: ['score', 'maxScore'],
          });

          attemptedCount = attempts.length;
          for (const attempt of attempts) {
            totalScore += Number(attempt.score);
            totalMaxScore += Number(attempt.maxScore);
          }
        }

        const averageScorePercentage =
          totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : null;

        return {
          courseId,
          courseTitle,
          topics,
          quizAttempt: { quizCount, attemptedCount, averageScorePercentage },
        };
      }),
    );
  },
};
