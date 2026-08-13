import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { attendanceRecordRepository } from '../repositories/attendanceRecords.repository.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { quizRepository } from '../repositories/quizzes.repository.js';
import { quizAttemptRepository } from '../repositories/quizAttempts.repository.js';
import { notificationRepository } from '../repositories/notifications.repository.js';
import { conceptEvidenceRepository } from '../repositories/conceptEvidence.repository.js';
import { studyPlanRepository } from '../repositories/studyPlan.repository.js';
import { buildStudentDashboard, buildStudentPerformanceSnapshot } from '../serializers/dashboard.serializer.js';
import { buildConceptInventory } from '../serializers/conceptEvidence.serializer.js';
import { serializeStudyPlan } from '../serializers/studyPlan.serializer.js';
import {
  studyPlannerSystemPrompt,
  buildStudyPlannerUserPrompt,
} from '../prompts/studyPlanner.prompt.js';
import { generateJson } from '../services/llm.service.js';
import { studyPlanContentSchema } from '../validations/dashboard.validation.js';
import { loadGradebook } from './gradebook.controller.js';
import { QUIZ_STATUS } from '../constants/index.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

export const getStudentDashboard = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const context = await loadStudentPerformanceContext(studentId);
    if (!context.placed) {
      const unreadNotificationCount = await notificationRepository.countUnread(studentId);
      return ok(
        res,
        {
          placed: false,
          courses: [],
          upcoming: [],
          recentGrades: [],
          performance: context.performance,
          unreadNotificationCount,
        },
        'Dashboard retrieved',
      );
    }

    const enrollments = context.enrollments;

    const [courseAssignments, courseQuizzes, unreadNotificationCount] = await Promise.all([
      Promise.all(
        enrollments.map(async (enrollment) => {
          const assignments = await assignmentRepository.findAllByCourse(
            enrollment.courseId,
            enrollment.academicYearId,
          );
          const submissionsByAssignmentId = new Map(
            await Promise.all(
              assignments.map(async (assignment) => {
                const submission = await submissionRepository.findByAssignmentAndStudent(
                  assignment.id,
                  studentId,
                );
                return [assignment.id, submission] as const;
              }),
            ),
          );
          return {
            courseId: enrollment.courseId,
            courseTitle: enrollment.course?.title ?? '',
            assignments,
            submissionsByAssignmentId,
          };
        }),
      ),
      Promise.all(
        enrollments.map(async (enrollment) => {
          const quizzes = await quizRepository.findAllByCourse(
            enrollment.courseId,
            enrollment.academicYearId,
            QUIZ_STATUS.PUBLISHED,
          );
          const attemptsByQuizId = new Map(
            await Promise.all(
              quizzes.map(async (q) => {
                const attempt = await quizAttemptRepository.findByQuizAndStudent(q.id, studentId);
                return [q.id, attempt] as const;
              }),
            ),
          );
          return {
            courseId: enrollment.courseId,
            courseTitle: enrollment.course?.title ?? '',
            quizzes,
            attemptsByQuizId,
          };
        }),
      ),
      notificationRepository.countUnread(studentId),
    ]);

    const dashboard = buildStudentDashboard(
      enrollments,
      courseAssignments,
      courseQuizzes,
      context.performance,
      unreadNotificationCount,
    );

    return ok(res, { placed: true, ...dashboard }, 'Dashboard retrieved');
  },
);

export const loadStudentPerformanceContext = async (studentId: string) => {
  const membership = await classMembershipRepository.findCurrent(studentId);
  if (!membership) {
    return {
      placed: false,
      enrollments: [],
      performance: buildStudentPerformanceSnapshot(studentId, []),
    };
  }

  const enrollments = await enrollmentRepository.findActiveWithDetails(
    studentId,
    membership.academicYearId,
  );

  const [courseAssignments, courseGradebooks, courseAttendanceRecords] = await Promise.all([
    Promise.all(
      enrollments.map(async (enrollment) => {
        const assignments = await assignmentRepository.findAllByCourse(
          enrollment.courseId,
          enrollment.academicYearId,
        );
        const submissionsByAssignmentId = new Map(
          await Promise.all(
            assignments.map(async (assignment) => {
              const submission = await submissionRepository.findByAssignmentAndStudent(
                assignment.id,
                studentId,
              );
              return [assignment.id, submission] as const;
            }),
          ),
        );
        return {
          courseId: enrollment.courseId,
          courseTitle: enrollment.course?.title ?? '',
          assignments,
          submissionsByAssignmentId,
        };
      }),
    ),
    Promise.all(enrollments.map(async (enrollment) => loadGradebook(enrollment.courseId))),
    Promise.all(
      enrollments.map(async (enrollment) =>
        attendanceRecordRepository.findByStudentAndCourse(studentId, enrollment.courseId),
      ),
    ),
  ]);

  const performance = buildStudentPerformanceSnapshot(
    studentId,
    enrollments.map((enrollment, index) => {
      const submissions = Array.from(courseAssignments[index]?.submissionsByAssignmentId.values() ?? []);
      const lateSubmissions = submissions.filter((submission) => submission?.isLate).length;
      const gradebook = courseGradebooks[index];
      if (!gradebook) {
        throw new ApiError(500, 'Failed to load course performance data');
      }
      return {
        courseId: enrollment.courseId,
        courseTitle: enrollment.course?.title ?? '',
        gradebook,
        attendanceRecords: courseAttendanceRecords[index] ?? [],
        lateSubmissions,
      };
    }),
  );

  return {
    placed: true,
    enrollments,
    performance,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Study Plan (Slice 6)
// ──────────────────────────────────────────────────────────────────────────────

export const getStudentStudyPlan = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) throw new ApiError(401, 'Unauthorized');

    const plan = await studyPlanRepository.findActive(studentId);

    // The only other staleness trigger is quiz/grade events within the plan's
    // own week (markPlanStaleIfCurrentWeek) — a plan nobody touched since a
    // past week (most obviously, a past semester: promotion always crosses
    // at least one week boundary) would otherwise stay "active" and get
    // served indefinitely, showing tasks for courses the student isn't even
    // enrolled in anymore. Check on every read instead of relying on an event
    // to catch it.
    if (plan && !plan.isStale && !studyPlanRepository.isCurrentWeekPlan(plan)) {
      await studyPlanRepository.markStale(
        plan,
        'This plan is from a previous week — regenerate it for an up-to-date plan.',
      );
    }

    return ok(res, plan ? serializeStudyPlan(plan) : null, 'Study plan retrieved');
  },
);

export const generateStudentStudyPlan = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) throw new ApiError(401, 'Unauthorized');

    const studentName = req.user?.name ?? 'Student';

    // Load the student's performance context — same data as the dashboard
    const context = await loadStudentPerformanceContext(studentId);

    // Collect upcoming assessments (assignments not yet submitted + published quizzes not yet attempted)
    const upcomingAssessments: { type: 'assignment' | 'quiz'; title: string; courseTitle: string; dueAt: string | null }[] = [];

    if (context.placed) {
      for (const enrollment of context.enrollments) {
        const courseTitle = enrollment.course?.title ?? '';

        const assignments = await assignmentRepository.findAllByCourse(
          enrollment.courseId,
          enrollment.academicYearId,
        );
        for (const assignment of assignments) {
          const submission = await submissionRepository.findByAssignmentAndStudent(
            assignment.id,
            studentId,
          );
          if (!submission) {
            upcomingAssessments.push({
              type: 'assignment',
              title: assignment.title,
              courseTitle,
              dueAt: assignment.dueAt instanceof Date ? assignment.dueAt.toISOString() : null,
            });
          }
        }

        const quizzes = await quizRepository.findAllByCourse(
          enrollment.courseId,
          enrollment.academicYearId,
          QUIZ_STATUS.PUBLISHED,
        );
        for (const quiz of quizzes) {
          const attempt = await quizAttemptRepository.findByQuizAndStudent(quiz.id, studentId);
          if (!attempt) {
            upcomingAssessments.push({
              type: 'quiz',
              title: quiz.title,
              courseTitle,
              dueAt: null,
            });
          }
        }
      }
    }

    // Collect weak concepts from concept evidence
    const weakConcepts: { topic: string; courseTitle: string; masteryState: string }[] = [];

    if (context.placed) {
      const enrolledCourses = context.enrollments.map((e) => ({
        courseId: e.courseId,
        courseTitle: e.course?.title ?? '',
        academicYearId: e.academicYearId,
      }));
      const courseEvidence = await conceptEvidenceRepository.findForStudent(studentId, enrolledCourses);
      const conceptInventory = buildConceptInventory(courseEvidence);

      for (const course of conceptInventory.courses) {
        for (const concept of course.concepts) {
          if (concept.masteryState === 'needs_attention' || concept.masteryState === 'developing') {
            weakConcepts.push({
              topic: concept.topic,
              courseTitle: course.courseTitle,
              masteryState: concept.masteryState,
            });
          }
        }
      }
    }

    // Determine the current week's Monday
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ...
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday);
    const weekStart = monday.toISOString().split('T')[0]!;
    const weekEndDate = new Date(monday);
    weekEndDate.setDate(monday.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0]!;

    const perf = context.performance;

    // Call the LLM with one retry on invalid JSON
    const userPrompt = buildStudyPlannerUserPrompt({
      studentName,
      weekStart,
      weekEnd,
      performance: {
        averageGrade: perf.averageGrade,
        attendancePercentage: perf.attendancePercentage,
        completionRate: perf.completionRate,
        missingSubmissions: perf.missingSubmissions,
      },
      upcomingAssessments,
      weakConcepts,
      courses: context.enrollments.map((e) => e.course?.title ?? '').filter(Boolean),
    });

    let parsedContent;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await generateJson(studyPlannerSystemPrompt, userPrompt, 4096);
        parsedContent = studyPlanContentSchema.parse(JSON.parse(raw));
        break;
      } catch {
        if (attempt === 1) throw new ApiError(502, 'Failed to generate a valid study plan');
      }
    }

    if (!parsedContent) throw new ApiError(502, 'Failed to generate a valid study plan');

    const plan = await studyPlanRepository.createAndSupersedePrevious(
      studentId,
      weekStart,
      parsedContent,
    );

    return ok(res, serializeStudyPlan(plan), 'Study plan generated', 201);
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// Study Plan Task Mutations
// ──────────────────────────────────────────────────────────────────────────────

export const toggleStudyPlanTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) throw new ApiError(401, 'Unauthorized');

    const { dayIndex, taskIndex, done } = req.validated?.body as {
      dayIndex: number;
      taskIndex: number;
      done: boolean;
    };

    const plan = await studyPlanRepository.findActive(studentId);
    if (!plan) throw new ApiError(404, 'No active study plan');

    const updated = await studyPlanRepository.toggleTaskDone(plan, dayIndex, taskIndex, done);
    if (!updated) throw new ApiError(400, 'dayIndex or taskIndex out of range');

    return ok(res, serializeStudyPlan(updated), 'Task updated');
  },
);

export const deleteStudyPlanTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) throw new ApiError(401, 'Unauthorized');

    const { dayIndex, taskIndex } = req.validated?.body as {
      dayIndex: number;
      taskIndex: number;
    };

    const plan = await studyPlanRepository.findActive(studentId);
    if (!plan) throw new ApiError(404, 'No active study plan');

    const updated = await studyPlanRepository.deleteTask(plan, dayIndex, taskIndex);
    if (!updated) throw new ApiError(400, 'dayIndex or taskIndex out of range');

    return ok(res, serializeStudyPlan(updated), 'Task deleted');
  },
);

export const addStudyPlanTask = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) throw new ApiError(401, 'Unauthorized');

    const { dayIndex, task } = req.validated?.body as {
      dayIndex: number;
      task: {
        title: string;
        description: string;
        estimatedMinutes: number;
        priority: 'high' | 'medium' | 'low';
        courseTitle?: string;
      };
    };

    const plan = await studyPlanRepository.findActive(studentId);
    if (!plan) throw new ApiError(404, 'No active study plan');

    const newTask = {
      type: 'review' as const,
      title: task.title,
      description: task.description,
      estimatedMinutes: task.estimatedMinutes,
      priority: task.priority,
      courseTitle: task.courseTitle,
      done: false,
    };

    const updated = await studyPlanRepository.addTask(plan, dayIndex, newTask);
    if (!updated) throw new ApiError(400, 'dayIndex out of range');

    return ok(res, serializeStudyPlan(updated), 'Task added');
  },
);
