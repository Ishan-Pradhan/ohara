import { Op } from 'sequelize';

import { Quiz } from '../models/quizzes.model.js';
import { Question } from '../models/questions.model.js';
import { QuizAttempt } from '../models/quizAttempts.model.js';
import { QuizAnswerGrade } from '../models/quizAnswerGrades.model.js';
import { Assignment } from '../models/assignments.model.js';
import { Submission } from '../models/submissions.model.js';
import { Grade } from '../models/grades.model.js';
import { QUIZ_STATUS, QUESTION_TYPES, GRADE_STATUS } from '../constants/index.js';

// ──────────────────────────────────────────────────────────────────────────────
// Output shapes
// ──────────────────────────────────────────────────────────────────────────────

export interface QuizPrepEvidence {
  assessmentType: 'quiz';
  assessmentId: string;
  assessmentTitle: string;
  courseId: string;
  courseTitle: string;
  /** Whether the student has already submitted an attempt. */
  alreadyAttempted: boolean;
  /** Attempt score as a percentage (0–100), or null if not attempted. */
  attemptScore: number | null;
  /** Total questions in the quiz. */
  totalQuestions: number;
  /** Questions the student has answered correctly across all quizzes in the course. */
  mcqCorrectRate: number | null;
  /** Per-question evidence for this quiz's MCQ questions. */
  questionBreakdown: QuestionBreakdown[];
  /** Weak concept areas from lesson keyTopics cross-referenced against course quiz performance. */
  weakTopics: string[];
}

export interface AssignmentPrepEvidence {
  assessmentType: 'assignment';
  assessmentId: string;
  assessmentTitle: string;
  courseId: string;
  courseTitle: string;
  dueAt: string | null;
  /** Whether the student has already submitted. */
  alreadySubmitted: boolean;
  /** Grade score percentage, or null if not yet graded. */
  gradeScore: number | null;
  /** Rubric criteria with the student's historical weak criteria from prior approved grades in this course. */
  weakCriteria: WeakCriterionBreakdown[];
  /** Overall assignment completion rate for the course (submitted / total). */
  completionRate: number | null;
}

export interface QuestionBreakdown {
  questionId: string;
  prompt: string;
  /** null = not in an existing attempt (first time exposure). */
  lastAnswerCorrect: boolean | null;
}

export interface WeakCriterionBreakdown {
  criterion: string;
  /** Score rate 0–1 across all approved grades in this course, or null if no history. */
  historicalScoreRate: number | null;
}

export type ExamPrepEvidence = QuizPrepEvidence | AssignmentPrepEvidence;

// ──────────────────────────────────────────────────────────────────────────────
// Repository
// ──────────────────────────────────────────────────────────────────────────────

export const examPrepRepository = {
  /**
   * Gathers preparation evidence for a specific quiz.
   * - Looks up the quiz and its questions.
   * - Checks whether the student has an existing attempt.
   * - Computes per-question correctness from the attempt's responses.
   * - Computes course-level MCQ correct rate from all course quiz attempts.
   */
  findQuizEvidence: async (
    studentId: string,
    quizId: string,
  ): Promise<QuizPrepEvidence | null> => {
    const quiz = await Quiz.findByPk(quizId, {
      include: [
        { model: Question, as: 'questions', separate: true, order: [['orderIndex', 'ASC']] },
        { association: 'course', attributes: ['id', 'title'] },
      ],
    });

    if (!quiz) return null;

    const courseId = quiz.courseId;

    // Determine if student has already attempted this quiz
    const existingAttempt = await QuizAttempt.findOne({
      where: { quizId, studentId },
    });

    let attemptScore: number | null = null;
    const questionBreakdown: QuestionBreakdown[] = [];

    const questions = (quiz.questions ?? []).filter((q) => q.type === QUESTION_TYPES.MCQ);

    if (existingAttempt) {
      // Build a response map for quick lookup
      const responseMap = new Map<string, number | null>();
      for (const resp of existingAttempt.responses) {
        responseMap.set(resp.questionId, typeof resp.answer === 'number' ? resp.answer : null);
      }

      for (const question of questions) {
        const studentAnswer = responseMap.get(question.id) ?? null;
        const correctIndex = question.answer?.correctIndex ?? null;
        const isCorrect =
          studentAnswer !== null && correctIndex !== null && studentAnswer === correctIndex;
        questionBreakdown.push({
          questionId: question.id,
          prompt: question.prompt,
          lastAnswerCorrect: studentAnswer !== null ? isCorrect : null,
        });
      }

      // Compute attempt score from approved short-answer grades + auto-scored MCQ
      const totalPoints = questions.reduce((acc, q) => acc + (q.points ?? 1), 0);
      const shortAnswerGrades = await QuizAnswerGrade.findAll({
        where: {
          attemptId: existingAttempt.id,
          status: GRADE_STATUS.APPROVED,
        },
        attributes: ['awardedPoints'],
      });
      const shortAnswerPoints = shortAnswerGrades.reduce((acc, g) => acc + g.awardedPoints, 0);
      const mcqPoints = questions.reduce(
        (acc, q) => {
          const studentAnswer = responseMap.get(q.id);
          const correctIndex = q.answer?.correctIndex;
          if (
            studentAnswer !== null &&
            studentAnswer !== undefined &&
            correctIndex !== null &&
            correctIndex !== undefined &&
            studentAnswer === correctIndex
          ) {
            return acc + (q.points ?? 1);
          }
          return acc;
        },
        0,
      );
      const earnedPoints = mcqPoints + shortAnswerPoints;
      attemptScore = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : null;
    } else {
      // No attempt — set up question breakdown without correctness info
      for (const question of questions) {
        questionBreakdown.push({
          questionId: question.id,
          prompt: question.prompt,
          lastAnswerCorrect: null,
        });
      }
    }

    // Course-level MCQ correct rate across all course quizzes (same as masteryEvidence.repository),
    // scoped to this quiz's own batch/year — a Course is reused by every future batch.
    const allCourseQuizzes = await Quiz.findAll({
      where: { courseId, academicYearId: quiz.academicYearId, status: QUIZ_STATUS.PUBLISHED },
      attributes: ['id'],
    });

    let mcqCorrectRate: number | null = null;

    if (allCourseQuizzes.length > 0) {
      const courseQuizIds = allCourseQuizzes.map((q) => q.id);
      const allQuestions = await Question.findAll({
        where: {
          quizId: { [Op.in]: courseQuizIds },
          type: QUESTION_TYPES.MCQ,
        },
        attributes: ['id', 'answer'],
      });

      const correctIndexById = new Map<string, number>();
      for (const q of allQuestions) {
        if (q.answer !== null) correctIndexById.set(q.id, q.answer.correctIndex);
      }

      if (correctIndexById.size > 0) {
        const allAttempts = await QuizAttempt.findAll({
          where: { studentId, quizId: { [Op.in]: courseQuizIds } },
          attributes: ['responses'],
        });

        let total = 0;
        let correct = 0;
        for (const attempt of allAttempts) {
          for (const resp of attempt.responses) {
            const correctIndex = correctIndexById.get(resp.questionId);
            if (correctIndex === undefined) continue;
            total += 1;
            if (resp.answer === correctIndex) correct += 1;
          }
        }
        mcqCorrectRate = total > 0 ? (correct / total) * 100 : null;
      }
    }

    return {
      assessmentType: 'quiz',
      assessmentId: quizId,
      assessmentTitle: quiz.title,
      courseId,
      courseTitle: quiz.course?.title ?? '',
      alreadyAttempted: existingAttempt !== null,
      attemptScore,
      totalQuestions: quiz.questions?.length ?? 0,
      mcqCorrectRate,
      questionBreakdown,
      weakTopics: [],
    };
  },

  /**
   * Gathers preparation evidence for a specific assignment.
   * - Looks up the assignment and its rubric.
   * - Checks if the student has submitted.
   * - Computes course-level weak criteria from prior approved grades.
   */
  findAssignmentEvidence: async (
    studentId: string,
    assignmentId: string,
  ): Promise<AssignmentPrepEvidence | null> => {
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [{ association: 'course', attributes: ['id', 'title'] }],
    });

    if (!assignment) return null;

    const courseId = assignment.courseId;

    // Check if the student has already submitted
    const existingSubmission = await Submission.findOne({
      where: { assignmentId, studentId },
      attributes: ['id'],
    });

    let gradeScore: number | null = null;
    if (existingSubmission) {
      const grade = await Grade.findOne({
        where: { submissionId: existingSubmission.id, status: GRADE_STATUS.APPROVED },
        attributes: ['score', 'criterionFeedback'],
      });
      if (grade) {
        // maxScore is derived from the rubric criteria's maxPoints
        const maxScore = grade.criterionFeedback.reduce((sum, cf) => sum + cf.maxPoints, 0);
        if (maxScore > 0) {
          gradeScore = (grade.score / maxScore) * 100;
        }
      }
    }

    // Course-level weak criteria from all approved grades in this course,
    // scoped to this assignment's own batch/year — a Course is reused by
    // every future batch.
    const allAssignments = await Assignment.findAll({
      where: { courseId, academicYearId: assignment.academicYearId },
      attributes: ['id'],
    });

    const weakCriteria: WeakCriterionBreakdown[] = [];

    if (allAssignments.length > 0) {
      const allAssignmentIds = allAssignments.map((a) => a.id);

      const allSubmissions = await Submission.findAll({
        where: { assignmentId: { [Op.in]: allAssignmentIds }, studentId },
        attributes: ['id'],
      });

      if (allSubmissions.length > 0) {
        const submissionIds = allSubmissions.map((s) => s.id);
        const grades = await Grade.findAll({
          where: { submissionId: { [Op.in]: submissionIds }, status: GRADE_STATUS.APPROVED },
          attributes: ['criterionFeedback'],
        });

        const criterionMap = new Map<string, { totalAwarded: number; totalMax: number }>();
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

        // Only expose rubric criteria from this assignment (with history if available)
        for (const criterion of assignment.rubric) {
          const hist = criterionMap.get(criterion.criterion);
          weakCriteria.push({
            criterion: criterion.criterion,
            historicalScoreRate:
              hist && hist.totalMax > 0 ? hist.totalAwarded / hist.totalMax : null,
          });
        }
      } else {
        // No history — expose all rubric criteria with null score rates
        for (const criterion of assignment.rubric) {
          weakCriteria.push({ criterion: criterion.criterion, historicalScoreRate: null });
        }
      }
    }

    // Assignment completion rate for the course
    const totalCourseAssignments = allAssignments.length;
    const submittedCount = await Submission.count({
      where: {
        assignmentId: { [Op.in]: allAssignments.map((a) => a.id) },
        studentId,
      },
    });
    const completionRate =
      totalCourseAssignments > 0 ? (submittedCount / totalCourseAssignments) * 100 : null;

    return {
      assessmentType: 'assignment',
      assessmentId: assignmentId,
      assessmentTitle: assignment.title,
      courseId,
      courseTitle: assignment.course?.title ?? '',
      dueAt: assignment.dueAt instanceof Date ? assignment.dueAt.toISOString() : null,
      alreadySubmitted: existingSubmission !== null,
      gradeScore,
      weakCriteria,
      completionRate,
    };
  },
};
