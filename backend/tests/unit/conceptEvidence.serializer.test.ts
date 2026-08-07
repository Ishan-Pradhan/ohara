import { describe, expect, it } from 'vitest';

import { buildConceptInventory } from '../../src/serializers/conceptEvidence.serializer.js';
import type { CourseConceptEvidence } from '../../src/repositories/conceptEvidence.repository.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const TOPICS = ['Newtons Laws', 'Thermodynamics', 'Optics'];

const evidence = (overrides: Partial<CourseConceptEvidence> = {}): CourseConceptEvidence => ({
  courseId: '11111111-1111-1111-1111-111111111111',
  courseTitle: 'Physics',
  topics: TOPICS,
  quizAttempt: {
    quizCount: 2,
    attemptedCount: 2,
    averageScorePercentage: 85,
  },
  ...overrides,
});

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe('buildConceptInventory', () => {
  it('returns an empty inventory when no courses are provided', () => {
    const result = buildConceptInventory([]);

    expect(result.totalConcepts).toBe(0);
    expect(result.conceptsWithEvidence).toBe(0);
    expect(result.courses).toHaveLength(0);
  });

  it('marks topics as strong when quiz average >= 80%', () => {
    const result = buildConceptInventory([
      evidence({ quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 90 } }),
    ]);

    const course = result.courses[0];
    expect(course).toBeDefined();
    expect(course!.concepts).toHaveLength(3);
    for (const concept of course!.concepts) {
      expect(concept.masteryState).toBe('strong');
      expect(concept.evidenceType).toBe('indirect');
    }
    expect(result.totalConcepts).toBe(3);
    expect(result.conceptsWithEvidence).toBe(3);
  });

  it('marks topics as developing when quiz average is 60-79%', () => {
    const result = buildConceptInventory([
      evidence({ quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 70 } }),
    ]);

    const course = result.courses[0];
    for (const concept of course!.concepts) {
      expect(concept.masteryState).toBe('developing');
      expect(concept.evidenceType).toBe('indirect');
    }
  });

  it('marks topics as needs_attention when quiz average < 60%', () => {
    const result = buildConceptInventory([
      evidence({ quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 45 } }),
    ]);

    const course = result.courses[0];
    for (const concept of course!.concepts) {
      expect(concept.masteryState).toBe('needs_attention');
      expect(concept.evidenceType).toBe('indirect');
    }
  });

  it('marks topics as insufficient_data when there are no quiz attempts', () => {
    const result = buildConceptInventory([
      evidence({
        quizAttempt: { quizCount: 2, attemptedCount: 0, averageScorePercentage: null },
      }),
    ]);

    const course = result.courses[0];
    expect(course!.hasQuizEvidence).toBe(false);
    for (const concept of course!.concepts) {
      expect(concept.masteryState).toBe('insufficient_data');
      expect(concept.evidenceType).toBe('none');
    }
    expect(result.conceptsWithEvidence).toBe(0);
  });

  it('marks topics as insufficient_data when there are no quizzes at all', () => {
    const result = buildConceptInventory([
      evidence({
        quizAttempt: { quizCount: 0, attemptedCount: 0, averageScorePercentage: null },
      }),
    ]);

    const course = result.courses[0];
    for (const concept of course!.concepts) {
      expect(concept.masteryState).toBe('insufficient_data');
    }
  });

  it('sets hasTopics false when topic list is empty', () => {
    const result = buildConceptInventory([evidence({ topics: [] })]);
    expect(result.courses[0]!.hasTopics).toBe(false);
    expect(result.totalConcepts).toBe(0);
  });

  it('sets hasTopics true when topics exist', () => {
    const result = buildConceptInventory([evidence()]);
    expect(result.courses[0]!.hasTopics).toBe(true);
  });

  it('aggregates totals across multiple courses correctly', () => {
    const course1 = evidence({
      courseId: 'aaa',
      topics: ['Topic A', 'Topic B'],
      quizAttempt: { quizCount: 1, attemptedCount: 1, averageScorePercentage: 88 },
    });
    const course2 = evidence({
      courseId: 'bbb',
      topics: ['Topic C'],
      quizAttempt: { quizCount: 1, attemptedCount: 0, averageScorePercentage: null },
    });

    const result = buildConceptInventory([course1, course2]);

    expect(result.totalConcepts).toBe(3);
    // course2 has no attempts so its topics do not count towards conceptsWithEvidence
    expect(result.conceptsWithEvidence).toBe(2);
    expect(result.courses).toHaveLength(2);
  });

  it('preserves the topic name exactly in each ConceptSnapshot', () => {
    const result = buildConceptInventory([evidence()]);

    const topicNames = result.courses[0]!.concepts.map((c) => c.topic);
    expect(topicNames).toEqual(TOPICS);
  });

  it('passes through quiz evidence numbers unchanged', () => {
    const result = buildConceptInventory([evidence()]);
    const quizEv = result.courses[0]!.quizEvidence;

    expect(quizEv.quizCount).toBe(2);
    expect(quizEv.attemptedCount).toBe(2);
    expect(quizEv.averageScorePercentage).toBe(85);
  });
});
