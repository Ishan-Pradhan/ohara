import type { ExamPrepEvidence, QuizPrepEvidence, AssignmentPrepEvidence } from '../repositories/examPrep.repository.js';

// ──────────────────────────────────────────────────────────────────────────────
// Readiness thresholds — deterministic, documented here
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Readiness state thresholds (percentage-based, 0–100).
 *
 *  READY        score ≥ 80%  → ready
 *  DEVELOPING   score ≥ 60%  → developing
 *                score < 60%  → needs_attention
 *  null score               → insufficient_data (no prior evidence)
 *
 * Consistent with mastery thresholds in conceptMastery.serializer.ts.
 */
const READY_THRESHOLD = 80;
const DEVELOPING_THRESHOLD = 60;

export type ReadinessState = 'ready' | 'developing' | 'needs_attention' | 'insufficient_data';

const readinessFromScore = (score: number | null): ReadinessState => {
  if (score === null) return 'insufficient_data';
  if (score >= READY_THRESHOLD) return 'ready';
  if (score >= DEVELOPING_THRESHOLD) return 'developing';
  return 'needs_attention';
};

// ──────────────────────────────────────────────────────────────────────────────
// Deterministic readiness score computation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Derives a readiness score (0–100) from the evidence.
 *
 * Quiz: uses `mcqCorrectRate` if available, falls back to `attemptScore`.
 * Assignment: uses `gradeScore` if available, falls back to `completionRate`.
 *
 * Never fabricates a value — returns null when there is no evidence.
 */
const computeReadinessScore = (evidence: ExamPrepEvidence): number | null => {
  if (evidence.assessmentType === 'quiz') {
    const ev = evidence as QuizPrepEvidence;
    // Prefer course-level MCQ correct rate (wider evidence base)
    if (ev.mcqCorrectRate !== null) return ev.mcqCorrectRate;
    // Fall back to the specific attempt score
    if (ev.attemptScore !== null) return ev.attemptScore;
    return null;
  } else {
    const ev = evidence as AssignmentPrepEvidence;
    // Prefer grade score (direct performance signal)
    if (ev.gradeScore !== null) return ev.gradeScore;
    // Do NOT fall back to completionRate — a 0% completion rate (no submissions yet)
    // does not mean the student is unready; it means there's insufficient evidence.
    return null;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Weak areas derivation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extracts weak areas from the evidence as plain string labels.
 * These are included verbatim in the response so the student knows
 * exactly what to review.
 */
const deriveWeakAreas = (evidence: ExamPrepEvidence): string[] => {
  if (evidence.assessmentType === 'quiz') {
    const ev = evidence as QuizPrepEvidence;
    const fromTopics = ev.weakTopics.map((t) => `Concept: ${t}`);
    const fromQuestions = ev.questionBreakdown
      .filter((q) => q.lastAnswerCorrect === false)
      .map((q) => `Question: ${q.prompt.length > 80 ? q.prompt.slice(0, 77) + '...' : q.prompt}`);
    return [...fromQuestions, ...fromTopics];
  } else {
    const ev = evidence as AssignmentPrepEvidence;
    return ev.weakCriteria
      .filter((c) => c.historicalScoreRate !== null && c.historicalScoreRate < DEVELOPING_THRESHOLD / 100)
      .map((c) => `Criterion: ${c.criterion} (${((c.historicalScoreRate ?? 0) * 100).toFixed(0)}%)`);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Serializer
// ──────────────────────────────────────────────────────────────────────────────

export interface ExamPrepAIOutput {
  explanation: string;
  recommendations: string[];
}

export interface ExamPrepDTO {
  assessmentType: 'quiz' | 'assignment';
  assessmentId: string;
  assessmentTitle: string;
  courseId: string;
  courseTitle: string;
  /** Deterministic readiness score (0–100) or null if no evidence. */
  readinessScore: number | null;
  readinessState: ReadinessState;
  /** Plain-string weak areas extracted from the evidence. */
  weakAreas: string[];
  /** True when the student has already attempted/submitted. */
  alreadyCompleted: boolean;
  /** AI-generated explanation and recommendations, or null if insufficient_data. */
  ai: ExamPrepAIOutput | null;
  /** Evidence summary for transparency. */
  evidence: Record<string, unknown>;
}

export const buildExamPrepResponse = (
  evidence: ExamPrepEvidence,
  ai: ExamPrepAIOutput | null,
): ExamPrepDTO => {
  const readinessScore = computeReadinessScore(evidence);
  const readinessState = readinessFromScore(readinessScore);
  const weakAreas = deriveWeakAreas(evidence);

  if (evidence.assessmentType === 'quiz') {
    const ev = evidence as QuizPrepEvidence;
    return {
      assessmentType: 'quiz',
      assessmentId: ev.assessmentId,
      assessmentTitle: ev.assessmentTitle,
      courseId: ev.courseId,
      courseTitle: ev.courseTitle,
      readinessScore,
      readinessState,
      weakAreas,
      alreadyCompleted: ev.alreadyAttempted,
      ai,
      evidence: {
        totalQuestions: ev.totalQuestions,
        mcqCorrectRate: ev.mcqCorrectRate,
        attemptScore: ev.attemptScore,
        alreadyAttempted: ev.alreadyAttempted,
        questionsWithPriorData: ev.questionBreakdown.filter((q) => q.lastAnswerCorrect !== null).length,
      },
    };
  } else {
    const ev = evidence as AssignmentPrepEvidence;
    return {
      assessmentType: 'assignment',
      assessmentId: ev.assessmentId,
      assessmentTitle: ev.assessmentTitle,
      courseId: ev.courseId,
      courseTitle: ev.courseTitle,
      readinessScore,
      readinessState,
      weakAreas,
      alreadyCompleted: ev.alreadySubmitted,
      ai,
      evidence: {
        alreadySubmitted: ev.alreadySubmitted,
        gradeScore: ev.gradeScore,
        completionRate: ev.completionRate,
        rubricCriteria: ev.weakCriteria.length,
        weakCriteria: ev.weakCriteria.filter(
          (c) => c.historicalScoreRate !== null && c.historicalScoreRate < DEVELOPING_THRESHOLD / 100,
        ).length,
      },
    };
  }
};
