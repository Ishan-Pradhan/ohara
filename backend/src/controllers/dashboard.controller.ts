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
import { masteryEvidenceRepository } from '../repositories/masteryEvidence.repository.js';
import { studyPlanRepository } from '../repositories/studyPlan.repository.js';
import { examPrepRepository } from '../repositories/examPrep.repository.js';
import { buildStudentDashboard, buildStudentPerformanceSnapshot } from '../serializers/dashboard.serializer.js';
import { buildLearningProfileFallback, serializeLearningProfile } from '../serializers/learningProfile.serializer.js';
import { buildConceptInventory } from '../serializers/conceptEvidence.serializer.js';
import { buildMasteryReport } from '../serializers/conceptMastery.serializer.js';
import { serializeStudyPlan } from '../serializers/studyPlan.serializer.js';
import { buildExamPrepResponse } from '../serializers/examPrep.serializer.js';
import {
  buildLearningProfileUserPrompt,
  learningProfileSystemPrompt,
} from '../prompts/learningProfile.prompt.js';
import {
  studyPlannerSystemPrompt,
  buildStudyPlannerUserPrompt,
} from '../prompts/studyPlanner.prompt.js';
import {
  examPrepSystemPrompt,
  buildExamPrepUserPrompt,
} from '../prompts/examPrep.prompt.js';
import { generateJson } from '../services/llm.service.js';
import { learningProfileInterpretationSchema, studyPlanContentSchema, examPrepAISchema, examPrepQuerySchema } from '../validations/dashboard.validation.js';
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

export const getStudentLearningProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const studentName = req.user?.name ?? 'Student';
    const context = await loadStudentPerformanceContext(studentId);
    const profile = await buildLearningProfile(studentName, context.performance);

    return ok(res, serializeLearningProfile(context.performance, profile), 'Learning profile retrieved');
  },
);

export const getStudentConceptInventory = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const context = await loadStudentPerformanceContext(studentId);

    // When the student has no placement yet, return an empty inventory rather
    // than an error — there is simply no evidence to show.
    if (!context.placed) {
      return ok(
        res,
        buildConceptInventory([]),
        'Concept inventory retrieved',
      );
    }

    const enrolledCourses = context.enrollments.map((enrollment) => ({
      courseId: enrollment.courseId,
      courseTitle: enrollment.course?.title ?? '',
      academicYearId: enrollment.academicYearId,
    }));

    const courseEvidence = await conceptEvidenceRepository.findForStudent(
      studentId,
      enrolledCourses,
    );

    return ok(res, buildConceptInventory(courseEvidence), 'Concept inventory retrieved');
  },
);

export const getStudentMasteryReport = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const context = await loadStudentPerformanceContext(studentId);

    if (!context.placed) {
      return ok(
        res,
        buildMasteryReport([], []),
        'Mastery report retrieved',
      );
    }

    const enrolledCourses = context.enrollments.map((enrollment) => ({
      courseId: enrollment.courseId,
      courseTitle: enrollment.course?.title ?? '',
      academicYearId: enrollment.academicYearId,
    }));

    // Fetch both evidence sets in parallel — they are independent queries
    const [courseEvidence, masteryEvidence] = await Promise.all([
      conceptEvidenceRepository.findForStudent(studentId, enrolledCourses),
      masteryEvidenceRepository.findForStudent(studentId, enrolledCourses),
    ]);

    return ok(res, buildMasteryReport(courseEvidence, masteryEvidence), 'Mastery report retrieved');
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

const buildLearningProfile = async (
  studentName: string,
  performance: ReturnType<typeof buildStudentPerformanceSnapshot>,
) => {
  if (performance.status === 'insufficient_data') {
    return buildLearningProfileFallback(studentName, performance);
  }

  try {
    const raw = await generateJson(
      learningProfileSystemPrompt,
      buildLearningProfileUserPrompt({ studentName, performance }),
      2048,
    );
    const parsed = learningProfileInterpretationSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    return buildLearningProfileFallback(studentName, performance);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Study Plan (Slice 6)
// ──────────────────────────────────────────────────────────────────────────────

export const getStudentStudyPlan = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) throw new ApiError(401, 'Unauthorized');

    const plan = await studyPlanRepository.findActive(studentId);
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

// ──────────────────────────────────────────────────────────────────────────────
// Exam Prep (Slice 8)
// ──────────────────────────────────────────────────────────────────────────────

export const getExamPrep = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const studentId = req.user?.id;
    if (!studentId) throw new ApiError(401, 'Unauthorized');

    const studentName = req.user?.name ?? 'Student';

    // Validate query params via the shared Zod schema
    const parsed = examPrepQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError(400, 'assessmentType (quiz|assignment) and assessmentId (UUID) are required');
    }
    const { assessmentType, assessmentId } = parsed.data;

    // ── 1. Fetch deterministic evidence ─────────────────────────────────────
    const evidence =
      assessmentType === 'quiz'
        ? await examPrepRepository.findQuizEvidence(studentId, assessmentId)
        : await examPrepRepository.findAssignmentEvidence(studentId, assessmentId);

    if (!evidence) {
      throw new ApiError(404, `${assessmentType === 'quiz' ? 'Quiz' : 'Assignment'} not found`);
    }

    // ── 2. Verify the student is enrolled in the course ──────────────────────
    const isEnrolled = await enrollmentRepository.isEnrolled(studentId, evidence.courseId);

    if (!isEnrolled) {
      throw new ApiError(403, 'You are not enrolled in the course that contains this assessment');
    }

    // ── 3. Compute readiness state deterministically ─────────────────────────
    const { readinessScore, readinessState } = (() => {
      // Import the pure computation from the serializer — avoids duplicating logic
      const tempDTO = buildExamPrepResponse(evidence, null);
      return { readinessScore: tempDTO.readinessScore, readinessState: tempDTO.readinessState };
    })();

    // ── 4. Call LLM for explanation + recommendations ────────────────────────
    //    Skip AI when there's no evidence to explain (insufficient_data).
    //    On any failure, degrade gracefully (ai = null) so the deterministic
    //    result is always returned.
    let ai: { explanation: string; recommendations: string[] } | null = null;

    if (readinessState !== 'insufficient_data') {
      try {
        const userPrompt = buildExamPrepUserPrompt({
          studentName,
          assessmentType,
          assessmentTitle: evidence.assessmentTitle,
          courseTitle: evidence.courseTitle,
          readinessState,
          readinessScore,
          evidence,
        });

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const raw = await generateJson(examPrepSystemPrompt, userPrompt, 1024);
            ai = examPrepAISchema.parse(JSON.parse(raw));
            break;
          } catch {
            if (attempt === 1) {
              // Second failure — degrade silently, still return deterministic result
              ai = null;
            }
          }
        }
      } catch {
        // Network/SDK failure — degrade silently
        ai = null;
      }
    }

    // ── 5. Serialize and return ──────────────────────────────────────────────
    return ok(res, buildExamPrepResponse(evidence, ai), 'Exam prep retrieved');
  },
);
