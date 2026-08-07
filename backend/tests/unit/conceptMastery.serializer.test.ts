import { describe, expect, it } from 'vitest';

import { buildMasteryReport } from '../../src/serializers/conceptMastery.serializer.js';
import type { CourseConceptEvidence } from '../../src/repositories/conceptEvidence.repository.js';
import type {
  CourseMasteryEvidence,
  QuestionCorrectnessRecord,
} from '../../src/repositories/masteryEvidence.repository.js';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const COURSE_ID = '11111111-1111-1111-1111-111111111111';
const COURSE_TITLE = 'Physics';

/** A CourseConceptEvidence fixture — minimal but valid */
const courseEvidence = (
  overrides: Partial<CourseConceptEvidence> = {},
): CourseConceptEvidence => ({
  courseId: COURSE_ID,
  courseTitle: COURSE_TITLE,
  topics: ["Newton's Laws", 'Thermodynamics'],
  quizAttempt: {
    quizCount: 2,
    attemptedCount: 2,
    averageScorePercentage: 85,
  },
  ...overrides,
});

/** A CourseMasteryEvidence fixture with no questions or criteria */
const masteryEvidence = (
  overrides: Partial<CourseMasteryEvidence> = {},
): CourseMasteryEvidence => ({
  courseId: COURSE_ID,
  courseTitle: COURSE_TITLE,
  questionCorrectness: [],
  criterionWeakness: [],
  ...overrides,
});

/** Build a QuestionCorrectnessRecord with the given correct rate */
const question = (
  id: string,
  correct: number,
  attempts: number,
): QuestionCorrectnessRecord => ({
  questionId: id,
  prompt: `Question ${id}`,
  attempts,
  correct,
  correctRate: attempts > 0 ? correct / attempts : null,
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('buildMasteryReport', () => {
  // ── Empty inputs ────────────────────────────────────────────────────────────

  it('returns zeros and an empty courses array when no course evidence is provided', () => {
    const result = buildMasteryReport([], []);

    expect(result.coursesWithEvidence).toBe(0);
    expect(result.coursesNeedingAttention).toBe(0);
    expect(result.courses).toHaveLength(0);
  });

  // ── Overall mastery derivation ───────────────────────────────────────────────

  it('derives overall mastery as strong when quiz average >= 80%', () => {
    const result = buildMasteryReport(
      [courseEvidence({ quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 90 } })],
      [masteryEvidence()],
    );

    const course = result.courses[0];
    expect(course).toBeDefined();
    expect(course!.overallMastery).toBe('strong');
  });

  it('derives overall mastery as developing when quiz average is 60–79%', () => {
    const result = buildMasteryReport(
      [courseEvidence({ quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 70 } })],
      [masteryEvidence()],
    );

    expect(result.courses[0]!.overallMastery).toBe('developing');
  });

  it('derives overall mastery as needs_attention when quiz average < 60%', () => {
    const result = buildMasteryReport(
      [courseEvidence({ quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 45 } })],
      [masteryEvidence()],
    );

    expect(result.courses[0]!.overallMastery).toBe('needs_attention');
    expect(result.coursesNeedingAttention).toBe(1);
  });

  it('derives overall mastery as insufficient_data when no quiz has been attempted', () => {
    const result = buildMasteryReport(
      [courseEvidence({ quizAttempt: { quizCount: 2, attemptedCount: 0, averageScorePercentage: null } })],
      [masteryEvidence()],
    );

    expect(result.courses[0]!.overallMastery).toBe('insufficient_data');
    expect(result.coursesNeedingAttention).toBe(0);
  });

  // ── MCQ mastery percentage ───────────────────────────────────────────────────

  it('sets mcqMasteryPercentage to null when no MCQ questions have been attempted', () => {
    const result = buildMasteryReport(
      [courseEvidence()],
      [masteryEvidence({ questionCorrectness: [] })],
    );

    expect(result.courses[0]!.mcqMasteryPercentage).toBeNull();
    expect(result.courses[0]!.evidence.mcqQuestionsAttempted).toBe(0);
    expect(result.courses[0]!.evidence.totalMcqQuestions).toBe(0);
  });

  it('computes mcqMasteryPercentage as the fraction of questions at the strong threshold', () => {
    // 2 strong (correctRate 1.0 and 0.8), 1 developing (0.7) → 2/3 ≈ 66.7%
    const result = buildMasteryReport(
      [courseEvidence()],
      [
        masteryEvidence({
          questionCorrectness: [
            question('q1', 5, 5),  // correctRate = 1.0 → strong
            question('q2', 4, 5),  // correctRate = 0.8 → strong (boundary)
            question('q3', 7, 10), // correctRate = 0.7 → developing
          ],
        }),
      ],
    );

    const course = result.courses[0]!;
    expect(course.mcqMasteryPercentage).toBeCloseTo((2 / 3) * 100, 1);
    expect(course.evidence.mcqQuestionsAttempted).toBe(3);
    expect(course.evidence.totalMcqQuestions).toBe(3);
  });

  it('does not count questions with zero attempts towards mcqMasteryPercentage', () => {
    // q1 has 0 attempts (correctRate null) — should not appear in attempted count
    const result = buildMasteryReport(
      [courseEvidence()],
      [
        masteryEvidence({
          questionCorrectness: [
            question('q1', 0, 0),  // no attempt
            question('q2', 5, 5),  // correctRate = 1.0 → strong
          ],
        }),
      ],
    );

    const course = result.courses[0]!;
    expect(course.mcqMasteryPercentage).toBeCloseTo(100, 1);
    expect(course.evidence.mcqQuestionsAttempted).toBe(1); // only q2 attempted
    expect(course.evidence.totalMcqQuestions).toBe(2);     // both in the list
  });

  // ── Weak question filtering and sorting ─────────────────────────────────────

  it('returns no weak questions when all attempted questions are at the strong threshold', () => {
    const result = buildMasteryReport(
      [courseEvidence()],
      [
        masteryEvidence({
          questionCorrectness: [
            question('q1', 5, 5), // 100%
            question('q2', 4, 5), // 80% — boundary, not weak
          ],
        }),
      ],
    );

    expect(result.courses[0]!.weakQuestions).toHaveLength(0);
  });

  it('classifies developing questions (60–<80%) correctly and sorts by correctRate ascending', () => {
    const result = buildMasteryReport(
      [courseEvidence()],
      [
        masteryEvidence({
          questionCorrectness: [
            question('q1', 7, 10),  // 70% → developing
            question('q2', 6, 10),  // 60% → developing (boundary)
            question('q3', 10, 10), // 100% → strong (excluded)
          ],
        }),
      ],
    );

    const weakQ = result.courses[0]!.weakQuestions;
    expect(weakQ).toHaveLength(2);
    // sorted ascending: 60% first, then 70%
    expect(weakQ[0]!.masteryState).toBe('developing');
    expect(weakQ[0]!.correctRate).toBeCloseTo(0.6, 3);
    expect(weakQ[1]!.correctRate).toBeCloseTo(0.7, 3);
  });

  it('classifies needs_attention questions (< 60%) and sorts below developing', () => {
    const result = buildMasteryReport(
      [courseEvidence()],
      [
        masteryEvidence({
          questionCorrectness: [
            question('q1', 7, 10),  // 70% → developing
            question('q2', 3, 10),  // 30% → needs_attention
          ],
        }),
      ],
    );

    const weakQ = result.courses[0]!.weakQuestions;
    expect(weakQ).toHaveLength(2);
    // sorted ascending: 30% first
    expect(weakQ[0]!.masteryState).toBe('needs_attention');
    expect(weakQ[0]!.correctRate).toBeCloseTo(0.3, 3);
    expect(weakQ[1]!.masteryState).toBe('developing');
  });

  // ── Weak criteria filtering and sorting ────────────────────────────────────

  it('returns no weak criteria when criterionWeakness is empty', () => {
    const result = buildMasteryReport([courseEvidence()], [masteryEvidence()]);
    expect(result.courses[0]!.weakCriteria).toHaveLength(0);
    expect(result.courses[0]!.evidence.criteriaEvaluated).toBe(0);
  });

  it('excludes strong criteria (scoreRate >= 0.8) from weakCriteria', () => {
    const result = buildMasteryReport(
      [courseEvidence()],
      [
        masteryEvidence({
          criterionWeakness: [
            { criterion: 'Analysis', totalAwarded: 8, totalMax: 10, scoreRate: 0.8 }, // strong boundary
            { criterion: 'Clarity', totalAwarded: 9, totalMax: 10, scoreRate: 0.9 },  // strong
          ],
        }),
      ],
    );

    expect(result.courses[0]!.weakCriteria).toHaveLength(0);
    expect(result.courses[0]!.evidence.criteriaEvaluated).toBe(2);
  });

  it('returns weak criteria sorted by scoreRate ascending (worst first)', () => {
    const result = buildMasteryReport(
      [courseEvidence()],
      [
        masteryEvidence({
          criterionWeakness: [
            { criterion: 'Structure', totalAwarded: 7, totalMax: 10, scoreRate: 0.7 },  // developing
            { criterion: 'Analysis', totalAwarded: 4, totalMax: 10, scoreRate: 0.4 },   // needs_attention
            { criterion: 'Grammar',  totalAwarded: 6, totalMax: 10, scoreRate: 0.6 },   // developing boundary
          ],
        }),
      ],
    );

    const wc = result.courses[0]!.weakCriteria;
    expect(wc).toHaveLength(3);
    expect(wc[0]!.criterion).toBe('Analysis');  // 40% — worst
    expect(wc[0]!.masteryState).toBe('needs_attention');
    expect(wc[1]!.criterion).toBe('Grammar');   // 60%
    expect(wc[1]!.masteryState).toBe('developing');
    expect(wc[2]!.criterion).toBe('Structure'); // 70%
  });

  // ── coursesWithEvidence counting ────────────────────────────────────────────

  it('counts a course as having evidence when quiz attempts exist', () => {
    const result = buildMasteryReport(
      [courseEvidence({ quizAttempt: { quizCount: 2, attemptedCount: 1, averageScorePercentage: 75 } })],
      [masteryEvidence()],
    );

    expect(result.coursesWithEvidence).toBe(1);
  });

  it('counts a course as having evidence when approved criteria exist (even with no quiz)', () => {
    const result = buildMasteryReport(
      [courseEvidence({ quizAttempt: { quizCount: 0, attemptedCount: 0, averageScorePercentage: null } })],
      [
        masteryEvidence({
          criterionWeakness: [
            { criterion: 'Clarity', totalAwarded: 5, totalMax: 10, scoreRate: 0.5 },
          ],
        }),
      ],
    );

    expect(result.coursesWithEvidence).toBe(1);
  });

  it('does not count a course as having evidence when both quiz attempts and criteria are absent', () => {
    const result = buildMasteryReport(
      [courseEvidence({ quizAttempt: { quizCount: 2, attemptedCount: 0, averageScorePercentage: null } })],
      [masteryEvidence()],
    );

    expect(result.coursesWithEvidence).toBe(0);
  });

  // ── Multi-course aggregation ─────────────────────────────────────────────────

  it('aggregates coursesNeedingAttention correctly across multiple courses', () => {
    const id1 = '11111111-1111-1111-1111-111111111111';
    const id2 = '22222222-2222-2222-2222-222222222222';
    const id3 = '33333333-3333-3333-3333-333333333333';

    const result = buildMasteryReport(
      [
        courseEvidence({ courseId: id1, quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 45 } }), // needs_attention
        courseEvidence({ courseId: id2, quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 85 } }), // strong
        courseEvidence({ courseId: id3, quizAttempt: { quizCount: 1, attemptedCount: 0, averageScorePercentage: null } }), // insufficient_data
      ],
      [
        masteryEvidence({ courseId: id1 }),
        masteryEvidence({ courseId: id2 }),
        masteryEvidence({ courseId: id3 }),
      ],
    );

    expect(result.courses).toHaveLength(3);
    expect(result.coursesNeedingAttention).toBe(1);
    expect(result.coursesWithEvidence).toBe(2); // id1 (attempted) and id2 (attempted)
  });

  // ── Missing mastery evidence (no entry for a course) ────────────────────────

  it('still returns a course report when no mastery evidence entry exists for that course', () => {
    // masteryEvidence array is empty — should not crash
    const result = buildMasteryReport([courseEvidence()], []);

    const course = result.courses[0];
    expect(course).toBeDefined();
    expect(course!.weakQuestions).toHaveLength(0);
    expect(course!.weakCriteria).toHaveLength(0);
    expect(course!.mcqMasteryPercentage).toBeNull();
  });
});
