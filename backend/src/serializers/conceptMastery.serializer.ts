import type {
  CourseMasteryEvidence,
  QuestionCorrectnessRecord,
  CriterionWeaknessRecord,
} from '../repositories/masteryEvidence.repository.js';
import type { CourseConceptEvidence } from '../repositories/conceptEvidence.repository.js';

// ──────────────────────────────────────────────────────────────────────────────
// Thresholds — documented here, deterministic
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Thresholds for mastery state derivation.
 * All values are fractions (0–1), not percentages.
 *
 *  STRONG_RATE    question correct ≥ 0.80  → strong
 *  DEVELOPING_RATE                ≥ 0.60  → developing
 *                                 < 0.60  → needs_attention
 *
 * Same numeric boundary as the course-level quiz average in conceptEvidence.serializer.ts
 * so the two layers feel coherent to the student.
 */
const STRONG_RATE = 0.8;
const DEVELOPING_RATE = 0.6;

export type MasteryState = 'strong' | 'developing' | 'needs_attention' | 'insufficient_data';

const masteryFromRate = (rate: number | null): MasteryState => {
  if (rate === null) return 'insufficient_data';
  if (rate >= STRONG_RATE) return 'strong';
  if (rate >= DEVELOPING_RATE) return 'developing';
  return 'needs_attention';
};

// ──────────────────────────────────────────────────────────────────────────────
// DTO shapes
// ──────────────────────────────────────────────────────────────────────────────

export interface WeakQuestion {
  questionId: string;
  prompt: string;
  attempts: number;
  correct: number;
  correctRate: number;
  masteryState: 'developing' | 'needs_attention';
}

export interface WeakCriterion {
  criterion: string;
  scoreRate: number;
  masteryState: 'developing' | 'needs_attention';
}

export interface CourseMasteryReport {
  courseId: string;
  courseTitle: string;
  /**
   * Overall course mastery derived from quiz average (course-level proxy,
   * same as Slice 3 ConceptInventory).
   */
  overallMastery: MasteryState;
  /**
   * Percentage of MCQ questions where the student's correct rate ≥ STRONG_RATE.
   * null when no MCQ questions have been attempted.
   */
  mcqMasteryPercentage: number | null;
  /**
   * Questions where correctRate < STRONG_RATE and at least one attempt exists.
   * Sorted by correctRate ascending (worst first).
   */
  weakQuestions: WeakQuestion[];
  /**
   * Assignment rubric criteria where scoreRate < STRONG_RATE, sorted by
   * scoreRate ascending (worst first).
   */
  weakCriteria: WeakCriterion[];
  evidence: {
    mcqQuestionsAttempted: number;
    totalMcqQuestions: number;
    criteriaEvaluated: number;
  };
}

export interface MasteryReportDTO {
  /** Total courses with any mastery evidence. */
  coursesWithEvidence: number;
  /** Courses in needs_attention state. */
  coursesNeedingAttention: number;
  courses: CourseMasteryReport[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Merges course-level quiz evidence (from Slice 3's conceptEvidence repository)
 * with per-question MCQ correctness and per-criterion assignment weakness
 * (from the new masteryEvidence repository) into a single MasteryReportDTO.
 *
 * The overall mastery per course comes from the quiz average (same source as
 * Slice 3 — keeps both layers consistent). The question and criterion evidence
 * adds granularity: it tells the student *which specific things* are weak, not
 * just *that* they are weak.
 */
export const buildMasteryReport = (
  courseEvidence: CourseConceptEvidence[],
  masteryEvidence: CourseMasteryEvidence[],
): MasteryReportDTO => {
  // Index mastery evidence by courseId for O(1) lookup
  const masteryByCourse = new Map(masteryEvidence.map((m) => [m.courseId, m]));

  let coursesWithEvidence = 0;
  let coursesNeedingAttention = 0;

  const courses: CourseMasteryReport[] = courseEvidence.map((ce) => {
    const mastery = masteryByCourse.get(ce.courseId);

    // ── Overall mastery from quiz average (Slice 3 source) ──
    const avgPct = ce.quizAttempt.averageScorePercentage;
    const overallMastery: MasteryState =
      avgPct === null
        ? 'insufficient_data'
        : avgPct >= STRONG_RATE * 100
          ? 'strong'
          : avgPct >= DEVELOPING_RATE * 100
            ? 'developing'
            : 'needs_attention';

    // ── Weak questions ──
    const questionRecords: QuestionCorrectnessRecord[] =
      mastery?.questionCorrectness ?? [];

    const attempted = questionRecords.filter((q) => q.attempts > 0);
    const strongCount = attempted.filter(
      (q) => q.correctRate !== null && q.correctRate >= STRONG_RATE,
    ).length;

    const mcqMasteryPercentage =
      attempted.length > 0 ? (strongCount / attempted.length) * 100 : null;

    const weakQuestions: WeakQuestion[] = attempted
      .filter((q) => {
        const state = masteryFromRate(q.correctRate);
        return state === 'developing' || state === 'needs_attention';
      })
      .map((q) => ({
        questionId: q.questionId,
        prompt: q.prompt,
        attempts: q.attempts,
        correct: q.correct,
        correctRate: q.correctRate ?? 0,
        masteryState: masteryFromRate(q.correctRate) as 'developing' | 'needs_attention',
      }))
      .sort((a, b) => a.correctRate - b.correctRate);

    // ── Weak criteria ──
    const criterionRecords: CriterionWeaknessRecord[] =
      mastery?.criterionWeakness ?? [];

    const weakCriteria: WeakCriterion[] = criterionRecords
      .filter((c) => {
        const state = masteryFromRate(c.scoreRate);
        return state === 'developing' || state === 'needs_attention';
      })
      .map((c) => ({
        criterion: c.criterion,
        scoreRate: c.scoreRate ?? 0,
        masteryState: masteryFromRate(c.scoreRate) as 'developing' | 'needs_attention',
      }))
      .sort((a, b) => a.scoreRate - b.scoreRate);

    const hasEvidence =
      ce.quizAttempt.attemptedCount > 0 || criterionRecords.length > 0;
    if (hasEvidence) coursesWithEvidence += 1;
    if (overallMastery === 'needs_attention') coursesNeedingAttention += 1;

    return {
      courseId: ce.courseId,
      courseTitle: ce.courseTitle,
      overallMastery,
      mcqMasteryPercentage,
      weakQuestions,
      weakCriteria,
      evidence: {
        mcqQuestionsAttempted: attempted.length,
        totalMcqQuestions: questionRecords.length,
        criteriaEvaluated: criterionRecords.length,
      },
    };
  });

  return { coursesWithEvidence, coursesNeedingAttention, courses };
};
