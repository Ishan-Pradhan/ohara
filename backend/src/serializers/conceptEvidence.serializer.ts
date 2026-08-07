import type { CourseConceptEvidence } from '../repositories/conceptEvidence.repository.js';

/**
 * Mastery states for an individual concept (topic).
 * Determined by the course-level quiz performance proxy:
 *   strong            ≥ 80 % average quiz score
 *   developing        ≥ 60 % average quiz score
 *   needs_attention   < 60 % average quiz score
 *   insufficient_data no quiz attempts in this course yet
 */
export type ConceptMasteryState =
  | 'strong'
  | 'developing'
  | 'needs_attention'
  | 'insufficient_data';

export interface ConceptSnapshot {
  topic: string;
  masteryState: ConceptMasteryState;
  /**
   * Evidence is always "indirect" because questions are not tagged to topics.
   * The course-level quiz percentage is used as the mastery proxy, and this
   * flag makes that transparency explicit.
   */
  evidenceType: 'indirect' | 'none';
}

export interface CourseConcepts {
  courseId: string;
  courseTitle: string;
  /** Concepts with their mastery state, ordered by topic appearance in lessons. */
  concepts: ConceptSnapshot[];
  /** Course-level quiz evidence used to compute mastery. */
  quizEvidence: {
    quizCount: number;
    attemptedCount: number;
    averageScorePercentage: number | null;
  };
  /** True when the course has at least one topic defined in lesson content. */
  hasTopics: boolean;
  /**
   * True when the student has at least one quiz attempt for this course.
   * Mastery states are meaningful only when this is true.
   */
  hasQuizEvidence: boolean;
}

export interface ConceptInventoryDTO {
  /**
   * Total unique concepts across all courses (topics may overlap between courses
   * but are deduplicated only within each course; cross-course deduplication
   * is intentionally avoided to keep each course's concept set independent).
   */
  totalConcepts: number;
  conceptsWithEvidence: number;
  courses: CourseConcepts[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Thresholds (matches learningProfile.serializer.ts for consistency)
// ──────────────────────────────────────────────────────────────────────────────
const STRONG_SCORE = 80;
const DEVELOPING_SCORE = 60;

const masteryFromScore = (averageScorePercentage: number | null): ConceptMasteryState => {
  if (averageScorePercentage === null) return 'insufficient_data';
  if (averageScorePercentage >= STRONG_SCORE) return 'strong';
  if (averageScorePercentage >= DEVELOPING_SCORE) return 'developing';
  return 'needs_attention';
};

/**
 * Maps raw CourseConceptEvidence rows into the public ConceptInventoryDTO.
 *
 * Because questions are not tagged to lesson topics, every concept in a course
 * shares the same mastery state — derived from the student's overall quiz
 * performance in that course. The evidenceType field is set to 'indirect' to
 * make this tradeoff visible.
 *
 * When a course has no quiz attempts the state is 'insufficient_data' and
 * evidenceType is 'none'.
 */
export const buildConceptInventory = (
  courseEvidence: CourseConceptEvidence[],
): ConceptInventoryDTO => {
  let totalConcepts = 0;
  let conceptsWithEvidence = 0;

  const courses: CourseConcepts[] = courseEvidence.map((course) => {
    const hasTopics = course.topics.length > 0;
    const hasQuizEvidence = course.quizAttempt.attemptedCount > 0;

    const masteryState = masteryFromScore(course.quizAttempt.averageScorePercentage);
    const evidenceType: 'indirect' | 'none' = hasQuizEvidence ? 'indirect' : 'none';

    const concepts: ConceptSnapshot[] = course.topics.map((topic) => ({
      topic,
      masteryState,
      evidenceType,
    }));

    totalConcepts += concepts.length;
    if (hasQuizEvidence) conceptsWithEvidence += concepts.length;

    return {
      courseId: course.courseId,
      courseTitle: course.courseTitle,
      concepts,
      quizEvidence: course.quizAttempt,
      hasTopics,
      hasQuizEvidence,
    };
  });

  return { totalConcepts, conceptsWithEvidence, courses };
};
