import { GRADE_STATUS } from '../constants/index.js';
import type { RubricCriterion } from '../types/assignments.types.js';
import type { Submission } from '../models/submissions.model.js';
import type { QuizAttempt } from '../models/quizAttempts.model.js';
import type {
  Gradebook,
  GradebookAssessment,
  GradebookEntry,
  GradebookRow,
} from '../types/gradebook.types.js';

interface AssignmentInput {
  id: string;
  title: string;
  rubric: RubricCriterion[];
  submissions: Submission[];
}

interface QuizInput {
  id: string;
  title: string;
  maxScore: number;
  /** hasPendingShortAnswer: this attempt answered at least one short-answer
   * question that isn't approved yet — score is provisional, same 'pending'
   * concept as an assignment's draft grade. */
  attempts: { attempt: QuizAttempt; hasPendingShortAnswer: boolean }[];
}

interface RosterEntry {
  studentId: string;
  studentName: string;
}

/** Pure aggregation — every argument is already-loaded data (the controller
 * does the fetching); this only shapes it into the student x assessment
 * matrix (FR-30). No DB access here. */
export const buildGradebook = (
  assignments: AssignmentInput[],
  quizzes: QuizInput[],
  roster: RosterEntry[],
): Gradebook => {
  const assessments: GradebookAssessment[] = [];
  const entriesByStudent = new Map<string, Map<string, GradebookEntry>>();
  for (const { studentId } of roster) {
    entriesByStudent.set(studentId, new Map());
  }

  for (const assignment of assignments) {
    const maxScore = assignment.rubric.reduce((sum, c) => sum + c.maxPoints, 0);
    assessments.push({ id: assignment.id, type: 'assignment', title: assignment.title, maxScore });

    for (const submission of assignment.submissions) {
      const studentEntries = entriesByStudent.get(submission.studentId);
      if (!studentEntries) continue; // submitted before dropping the course — not on the current roster

      let status: GradebookEntry['status'] = 'ungraded';
      let score: number | null = null;
      if (submission.grade) {
        if (submission.grade.status === GRADE_STATUS.APPROVED) {
          status = 'graded';
          score = Number(submission.grade.score);
        } else {
          status = 'pending';
        }
      }
      studentEntries.set(assignment.id, { assessmentId: assignment.id, type: 'assignment', score, maxScore, status });
    }
  }

  for (const quiz of quizzes) {
    assessments.push({ id: quiz.id, type: 'quiz', title: quiz.title, maxScore: quiz.maxScore });

    for (const { attempt, hasPendingShortAnswer } of quiz.attempts) {
      const studentEntries = entriesByStudent.get(attempt.studentId);
      if (!studentEntries) continue;
      studentEntries.set(quiz.id, {
        assessmentId: quiz.id,
        type: 'quiz',
        score: Number(attempt.score),
        maxScore: Number(attempt.maxScore),
        status: hasPendingShortAnswer ? 'pending' : 'graded',
      });
    }
  }

  const rows: GradebookRow[] = roster.map(({ studentId, studentName }) => {
    const studentEntries = entriesByStudent.get(studentId) ?? new Map<string, GradebookEntry>();
    const entries: GradebookEntry[] = assessments.map(
      (a) =>
        studentEntries.get(a.id) ?? {
          assessmentId: a.id,
          type: a.type,
          score: null,
          maxScore: a.maxScore,
          status: a.type === 'assignment' ? ('not_submitted' as const) : ('not_attempted' as const),
        },
    );

    const graded = entries.filter((e) => e.score !== null);
    const totalScore = graded.reduce((sum, e) => sum + (e.score ?? 0), 0);
    const totalMaxScore = graded.reduce((sum, e) => sum + e.maxScore, 0);
    const average = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : null;

    return { studentId, studentName, entries, totalScore, totalMaxScore, average };
  });

  return { assessments, rows };
};
