import type { Assignment } from '../models/assignments.model.js';
import type { Submission } from '../models/submissions.model.js';
import type { Quiz } from '../models/quizzes.model.js';
import type { QuizAttempt } from '../models/quizAttempts.model.js';
import type { Enrollment } from '../models/enrollments.model.js';

interface CourseAssignments {
  courseId: string;
  courseTitle: string;
  assignments: Assignment[];
  submissionsByAssignmentId: Map<string, Submission | null>;
}

interface CourseQuizzes {
  courseId: string;
  courseTitle: string;
  quizzes: Quiz[];
  attemptsByQuizId: Map<string, QuizAttempt | null>;
}

const UPCOMING_LIMIT = 5;
const RECENT_GRADES_LIMIT = 5;

/** Pure aggregation — every argument is already-loaded data; this only
 * shapes it into the student dashboard's widgets. No DB access here, same
 * separation as gradebook.serializer.ts's buildGradebook. */
export const buildStudentDashboard = (
  enrollments: Enrollment[],
  courseAssignments: CourseAssignments[],
  courseQuizzes: CourseQuizzes[],
  unreadNotificationCount: number,
) => {
  const courses = enrollments
    .map((e) => e.course)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ id: c.id, title: c.title, code: c.code }));

  const upcoming: {
    type: 'assignment' | 'quiz';
    id: string;
    courseId: string;
    courseTitle: string;
    title: string;
    dueAt: string | null;
  }[] = [];

  for (const { courseId, courseTitle, assignments, submissionsByAssignmentId } of courseAssignments) {
    for (const assignment of assignments) {
      if (submissionsByAssignmentId.get(assignment.id)) continue; // already submitted
      upcoming.push({
        type: 'assignment',
        id: assignment.id,
        courseId,
        courseTitle,
        title: assignment.title,
        dueAt: assignment.dueAt.toISOString(),
      });
    }
  }

  for (const { courseId, courseTitle, quizzes, attemptsByQuizId } of courseQuizzes) {
    for (const quiz of quizzes) {
      if (attemptsByQuizId.get(quiz.id)) continue; // already attempted
      upcoming.push({
        type: 'quiz',
        id: quiz.id,
        courseId,
        courseTitle,
        title: quiz.title,
        dueAt: null,
      });
    }
  }

  upcoming.sort((a, b) => {
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return 0;
  });

  const recentGrades: {
    type: 'assignment' | 'quiz';
    id: string;
    courseId: string;
    courseTitle: string;
    title: string;
    score: number;
    maxScore: number;
    gradedAt: string;
  }[] = [];

  for (const { courseId, courseTitle, assignments, submissionsByAssignmentId } of courseAssignments) {
    for (const assignment of assignments) {
      const submission = submissionsByAssignmentId.get(assignment.id);
      if (!submission?.grade || submission.grade.status !== 'approved') continue;
      const maxScore = assignment.rubric.reduce((sum, c) => sum + c.maxPoints, 0);
      recentGrades.push({
        type: 'assignment',
        id: assignment.id,
        courseId,
        courseTitle,
        title: assignment.title,
        score: Number(submission.grade.score),
        maxScore,
        gradedAt: submission.grade.updatedAt.toISOString(),
      });
    }
  }

  for (const { courseId, courseTitle, quizzes, attemptsByQuizId } of courseQuizzes) {
    for (const quiz of quizzes) {
      const attempt = attemptsByQuizId.get(quiz.id);
      if (!attempt) continue;
      recentGrades.push({
        type: 'quiz',
        id: quiz.id,
        courseId,
        courseTitle,
        title: quiz.title,
        score: Number(attempt.score),
        maxScore: Number(attempt.maxScore),
        gradedAt: attempt.submittedAt.toISOString(),
      });
    }
  }

  recentGrades.sort((a, b) => b.gradedAt.localeCompare(a.gradedAt));

  return {
    courses,
    upcoming: upcoming.slice(0, UPCOMING_LIMIT),
    recentGrades: recentGrades.slice(0, RECENT_GRADES_LIMIT),
    unreadNotificationCount,
  };
};
