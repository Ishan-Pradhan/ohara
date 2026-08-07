import type { Assignment } from '../models/assignments.model.js';
import type { Submission } from '../models/submissions.model.js';
import type { Quiz } from '../models/quizzes.model.js';
import type { QuizAttempt } from '../models/quizAttempts.model.js';
import type { Enrollment } from '../models/enrollments.model.js';
import type { AttendanceStatus } from '../types/attendance.types.js';
import type { Gradebook } from '../types/gradebook.types.js';
import { buildAttendancePercentage } from './attendance.serializer.js';

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

type PerformanceStatus = 'ready' | 'insufficient_data';

export interface StudentPerformanceCourseInput {
  courseId: string;
  courseTitle: string;
  gradebook: Gradebook;
  attendanceRecords: { status: AttendanceStatus }[];
  lateSubmissions: number;
}

export interface StudentPerformanceCourseSnapshot {
  courseId: string;
  courseTitle: string;
  status: PerformanceStatus;
  averageGrade: number | null;
  attendancePercentage: number | null;
  completionRate: number | null;
  missingSubmissions: number;
  lateSubmissions: number;
  evidence: {
    assessments: number;
    gradedAssessments: number;
    completedAssessments: number;
    attendanceRecords: number;
  };
}

export interface StudentPerformanceSnapshot {
  status: PerformanceStatus;
  averageGrade: number | null;
  attendancePercentage: number | null;
  completionRate: number | null;
  missingSubmissions: number;
  lateSubmissions: number;
  evidence: {
    courses: number;
    assessments: number;
    gradedAssessments: number;
    completedAssessments: number;
    attendanceRecords: number;
  };
  courses: StudentPerformanceCourseSnapshot[];
}

const UPCOMING_LIMIT = 5;
const RECENT_GRADES_LIMIT = 5;

const buildCoursePerformance = (
  studentId: string,
  input: StudentPerformanceCourseInput,
): StudentPerformanceCourseSnapshot => {
  const row = input.gradebook.rows.find((gradebookRow) => gradebookRow.studentId === studentId);
  const assessments = input.gradebook.assessments.length;
  const gradedAssessments = row ? row.entries.filter((entry) => entry.score !== null).length : 0;
  const completedAssessments = row
    ? row.entries.filter((entry) => entry.status !== 'not_submitted' && entry.status !== 'not_attempted').length
    : 0;
  const missingSubmissions = row
    ? row.entries.filter((entry) => entry.status === 'not_submitted').length
    : 0;
  const attendance = buildAttendancePercentage(input.attendanceRecords);

  return {
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    status: assessments > 0 || input.attendanceRecords.length > 0 ? 'ready' : 'insufficient_data',
    averageGrade: row && row.totalMaxScore > 0 ? row.average : null,
    attendancePercentage: attendance.percentage,
    completionRate: assessments > 0 ? (completedAssessments / assessments) * 100 : null,
    missingSubmissions,
    lateSubmissions: input.lateSubmissions,
    evidence: {
      assessments,
      gradedAssessments,
      completedAssessments,
      attendanceRecords: input.attendanceRecords.length,
    },
  };
};

/** Pure aggregation of the student's performance evidence across their
 * enrolled courses. It does not query the DB; the controller passes in the
 * already-loaded gradebook and attendance data. */
export const buildStudentPerformanceSnapshot = (
  studentId: string,
  courses: StudentPerformanceCourseInput[],
): StudentPerformanceSnapshot => {
  const courseSnapshots = courses.map((course) => buildCoursePerformance(studentId, course));

  const aggregate = courseSnapshots.reduce(
    (acc, course) => {
      const courseInput = courses.find((candidate) => candidate.courseId === course.courseId);
      const row = courseInput?.gradebook.rows.find((gradebookRow) => gradebookRow.studentId === studentId);

      acc.assessments += course.evidence.assessments;
      acc.gradedAssessments += course.evidence.gradedAssessments;
      acc.completedAssessments += course.evidence.completedAssessments;
      acc.attendanceRecords += course.evidence.attendanceRecords;
      acc.missingSubmissions += course.missingSubmissions;
      acc.lateSubmissions += course.lateSubmissions;
      acc.totalScore += row?.totalScore ?? 0;
      acc.totalMaxScore += row?.totalMaxScore ?? 0;
      acc.attendanceStatuses.push(...(courseInput?.attendanceRecords ?? []));
      return acc;
    },
    {
      assessments: 0,
      gradedAssessments: 0,
      completedAssessments: 0,
      attendanceRecords: 0,
      missingSubmissions: 0,
      lateSubmissions: 0,
      totalScore: 0,
      totalMaxScore: 0,
      attendanceStatuses: [] as { status: AttendanceStatus }[],
    },
  );

  const attendance = buildAttendancePercentage(aggregate.attendanceStatuses);
  const averageGrade = aggregate.totalMaxScore > 0 ? (aggregate.totalScore / aggregate.totalMaxScore) * 100 : null;
  const completionRate = aggregate.assessments > 0 ? (aggregate.completedAssessments / aggregate.assessments) * 100 : null;
  const status: PerformanceStatus = aggregate.assessments > 0 || aggregate.attendanceRecords > 0
    ? 'ready'
    : 'insufficient_data';

  return {
    status,
    averageGrade,
    attendancePercentage: attendance.percentage,
    completionRate,
    missingSubmissions: aggregate.missingSubmissions,
    lateSubmissions: aggregate.lateSubmissions,
    evidence: {
      courses: courseSnapshots.length,
      assessments: aggregate.assessments,
      gradedAssessments: aggregate.gradedAssessments,
      completedAssessments: aggregate.completedAssessments,
      attendanceRecords: aggregate.attendanceRecords,
    },
    courses: courseSnapshots,
  };
};

/** Pure aggregation — every argument is already-loaded data; this only
 * shapes it into the student dashboard's widgets. No DB access here, same
 * separation as gradebook.serializer.ts's buildGradebook. */
export const buildStudentDashboard = (
  enrollments: Enrollment[],
  courseAssignments: CourseAssignments[],
  courseQuizzes: CourseQuizzes[],
  performance: StudentPerformanceSnapshot,
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
    performance,
    unreadNotificationCount,
  };
};

/**
 * Converts a student's performance snapshot into a compact text block for
 * injection into the tutor's system prompt. The text is intentionally brief —
 * it provides grounding context, not a full report. It does not contain any
 * course material, so the grounding rules ("answer only from course material")
 * still apply to factual content; this context is only for personalising
 * explanations (e.g. "based on your current attendance of 60% ...").
 *
 * Returns null when the snapshot has insufficient data, so the tutor can skip
 * the injection entirely and avoid mentioning performance when there is none.
 */
export const buildTutorLearningContext = (
  snapshot: StudentPerformanceSnapshot,
): string | null => {
  if (snapshot.status === 'insufficient_data') {
    return null;
  }

  const lines: string[] = [];

  if (snapshot.averageGrade !== null) {
    lines.push(`Overall average grade: ${snapshot.averageGrade.toFixed(1)}%`);
  }
  if (snapshot.attendancePercentage !== null) {
    lines.push(`Attendance: ${snapshot.attendancePercentage.toFixed(1)}%`);
  }
  if (snapshot.completionRate !== null) {
    lines.push(`Assignment completion: ${snapshot.completionRate.toFixed(1)}%`);
  }
  if (snapshot.missingSubmissions > 0) {
    lines.push(`Missing submissions: ${snapshot.missingSubmissions}`);
  }
  if (snapshot.lateSubmissions > 0) {
    lines.push(`Late submissions: ${snapshot.lateSubmissions}`);
  }

  // Per-course lines (only for the active courses the student is enrolled in)
  for (const course of snapshot.courses) {
    if (course.status !== 'ready') continue;
    const parts: string[] = [];
    if (course.averageGrade !== null) parts.push(`avg ${course.averageGrade.toFixed(1)}%`);
    if (course.attendancePercentage !== null) parts.push(`attendance ${course.attendancePercentage.toFixed(1)}%`);
    if (parts.length > 0) {
      lines.push(`  ${course.courseTitle}: ${parts.join(', ')}`);
    }
  }

  if (lines.length === 0) {
    return null;
  }

  return [
    'Student learning context (use only to personalise explanations — never invent grades or override official academic records):',
    ...lines,
  ].join('\n');
};
