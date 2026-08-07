import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { assignmentRepository } from '../repositories/assignments.repository.js';
import { submissionRepository } from '../repositories/submissions.repository.js';
import { gradeRepository } from '../repositories/grades.repository.js';
import { notificationRepository } from '../repositories/notifications.repository.js';
import { studyPlanRepository } from '../repositories/studyPlan.repository.js';
import {
  serializeSubmission,
  serializeSubmissionForStudent,
} from '../serializers/submissions.serializer.js';
import { serializeGrade } from '../serializers/grades.serializer.js';
import { uploadBuffer, deleteFile, downloadBuffer } from '../services/cloudinary.service.js';
import { generateJson } from '../services/llm.service.js';
import { extractSubmissionText } from '../utils/fileExtraction.utils.js';
import {
  gradingSystemPrompt,
  gradingUserPrompt,
  gradingCorrectivePrompt,
} from '../prompts/grading.prompt.js';
import { gradingResultSchema } from '../validations/submissions.validation.js';
import { GRADE_STATUS } from '../constants/index.js';
import type { CriterionFeedback } from '../types/grades.types.js';
import type { Assignment } from '../models/assignments.model.js';
import type { Submission } from '../models/submissions.model.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

const findOwnedAssignment = async (courseId: string, assignmentId: string): Promise<Assignment> => {
  const assignment = await assignmentRepository.findById(assignmentId);
  if (!assignment || assignment.courseId !== courseId) {
    throw new ApiError(404, 'Assignment not found');
  }
  return assignment;
};

const findOwnedSubmission = async (assignmentId: string, submissionId: string): Promise<Submission> => {
  const submission = await submissionRepository.findById(submissionId);
  if (!submission || submission.assignmentId !== assignmentId) {
    throw new ApiError(404, 'Submission not found');
  }
  return submission;
};

// ── Submit / resubmit ───────────────────────────────────────────────────────

export const submitAssignment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: assignmentId } = req.validated?.params as {
      courseId: string;
      id: string;
    };
    const { content } = req.validated?.body as { content?: string };
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const assignment = await findOwnedAssignment(courseId, assignmentId);

    if (!content && !req.file) {
      throw new ApiError(400, 'Submission must include text content or a file');
    }

    const existing = await submissionRepository.findByAssignmentAndStudent(assignmentId, studentId);
    if (existing?.grade?.status === GRADE_STATUS.APPROVED) {
      throw new ApiError(409, 'This submission already has an approved grade and cannot be resubmitted');
    }
    // A resubmission invalidates any AI draft graded against the old content.
    if (existing?.grade) {
      await gradeRepository.deleteBySubmissionId(existing.id);
    }

    const isLate = Date.now() > assignment.dueAt.getTime();

    const fileData = req.file
      ? await uploadBuffer(req.file.buffer, `submissions/${assignmentId}`)
      : null;

    if (fileData && existing?.filePublicId) {
      // Best-effort cleanup of the previous file on a resubmission; a failure
      // here shouldn't block the resubmission itself.
      try {
        await deleteFile(existing.filePublicId);
      } catch (err) {
        logger.warn({ err, submissionId: existing.id }, 'Could not remove previous submission file');
      }
    }

    const submissionData = {
      content: content ?? existing?.content ?? null,
      ...(fileData
        ? {
            fileUrl: fileData.url,
            filePublicId: fileData.publicId,
            fileOriginalName: req.file?.originalname ?? null,
            fileMimeType: req.file?.mimetype ?? null,
          }
        : {}),
      isLate,
      submittedAt: new Date(),
    };

    const submission = existing
      ? await submissionRepository.update(existing.id, submissionData)
      : await submissionRepository.create({ assignmentId, studentId, ...submissionData });

    if (!submission) {
      throw new ApiError(404, 'Submission not found');
    }
    return ok(res, serializeSubmissionForStudent(submission), 'Submission received', 201);
  },
);

export const getMySubmission = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: assignmentId } = req.validated?.params as {
      courseId: string;
      id: string;
    };
    const studentId = req.user?.id;
    if (!studentId) {
      throw new ApiError(401, 'Unauthorized');
    }

    await findOwnedAssignment(courseId, assignmentId);
    const submission = await submissionRepository.findByAssignmentAndStudent(assignmentId, studentId);
    return ok(
      res,
      submission ? serializeSubmissionForStudent(submission) : null,
      'Submission retrieved',
    );
  },
);

export const listSubmissions = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: assignmentId } = req.validated?.params as {
      courseId: string;
      id: string;
    };
    await findOwnedAssignment(courseId, assignmentId);
    const submissions = await submissionRepository.findAllByAssignment(assignmentId);
    return ok(res, submissions.map(serializeSubmission), 'Submissions retrieved');
  },
);

// ── AI grading ───────────────────────────────────────────────────────────────

/** Calls the LLM, parses and Zod-validates the response, and retries once
 * with a corrective re-prompt — same bounded shape as
 * courseContent.controller.ts's generateStructure. maxPoints is never taken
 * from the model: every awarded score is clamped against the assignment's
 * own rubric, which is the only source of truth for point values. */
const gradeSubmissionWithAI = async (
  assignment: Assignment,
  submissionText: string,
): Promise<{ score: number; criterionFeedback: CriterionFeedback[]; overallFeedback: string }> => {
  const userPrompt = gradingUserPrompt(assignment.prompt, assignment.rubric, submissionText);
  const raw = await generateJson(gradingSystemPrompt, userPrompt);

  let parsed = tryParseGrading(raw);
  if (!parsed.success) {
    const retryRaw = await generateJson(gradingSystemPrompt, gradingCorrectivePrompt(raw));
    parsed = tryParseGrading(retryRaw);
  }
  if (!parsed.success) {
    throw new ApiError(502, 'The LLM could not produce a valid grade after a retry');
  }

  const criterionFeedback: CriterionFeedback[] = assignment.rubric.map((rubricCriterion) => {
    const match = parsed.data.criterionFeedback.find(
      (c) => c.criterion.trim().toLowerCase() === rubricCriterion.criterion.trim().toLowerCase(),
    );
    const awardedPoints = match
      ? Math.min(Math.max(match.awardedPoints, 0), rubricCriterion.maxPoints)
      : 0;
    return {
      criterion: rubricCriterion.criterion,
      maxPoints: rubricCriterion.maxPoints,
      awardedPoints,
      feedback: match?.feedback ?? 'The AI did not provide feedback for this criterion.',
    };
  });

  const score = criterionFeedback.reduce((sum, c) => sum + c.awardedPoints, 0);
  return { score, criterionFeedback, overallFeedback: parsed.data.overallFeedback };
};

const tryParseGrading = (raw: string) => {
  try {
    const json: unknown = JSON.parse(raw);
    return gradingResultSchema.safeParse(json);
  } catch {
    return { success: false as const };
  }
};

/** Builds the gradable text for a submission: its text content plus, when
 * the attached file is a supported type, its extracted text. Throws 400 if
 * there's nothing to grade (e.g. an xlsx/image-only submission). */
const buildSubmissionText = async (submission: Submission): Promise<string> => {
  let fileText: string | null = null;
  if (submission.fileUrl && submission.fileMimeType) {
    const buffer = await downloadBuffer(submission.fileUrl);
    fileText = await extractSubmissionText(submission.fileMimeType, buffer);
  }

  const parts = [submission.content, fileText].filter((p): p is string => !!p && p.trim().length > 0);
  if (parts.length === 0) {
    throw new ApiError(
      400,
      'Submission has no gradable content (no text, or an unextractable file type)',
    );
  }
  return parts.join('\n\n');
};

/** Shared by the single-submission and grade-all routes. */
const gradeOneSubmission = async (assignment: Assignment, submission: Submission) => {
  const existingGrade = await gradeRepository.findBySubmissionId(submission.id);
  if (existingGrade?.status === GRADE_STATUS.APPROVED) {
    throw new ApiError(409, 'Grade is already approved');
  }

  const submissionText = await buildSubmissionText(submission);
  const { score, criterionFeedback, overallFeedback } = await gradeSubmissionWithAI(
    assignment,
    submissionText,
  );

  if (existingGrade) {
    await gradeRepository.deleteBySubmissionId(submission.id);
  }
  return await gradeRepository.create({
    submissionId: submission.id,
    score,
    criterionFeedback,
    overallFeedback,
    status: GRADE_STATUS.DRAFT,
  });
};

export const gradeSubmission = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: assignmentId, submissionId } = req.validated?.params as {
      courseId: string;
      id: string;
      submissionId: string;
    };

    const assignment = await findOwnedAssignment(courseId, assignmentId);
    const submission = await findOwnedSubmission(assignmentId, submissionId);

    const grade = await gradeOneSubmission(assignment, submission);
    return ok(res, serializeGrade(grade), 'Draft grade generated');
  },
);

export const gradeAllSubmissions = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: assignmentId } = req.validated?.params as {
      courseId: string;
      id: string;
    };

    const assignment = await findOwnedAssignment(courseId, assignmentId);
    const submissions = await submissionRepository.findAllByAssignment(assignmentId);
    const ungraded = submissions.filter((s) => !s.grade);

    let graded = 0;
    const errors: { submissionId: string; error: string }[] = [];
    for (const submission of ungraded) {
      try {
        await gradeOneSubmission(assignment, submission);
        graded += 1;
      } catch (err) {
        errors.push({
          submissionId: submission.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return ok(
      res,
      { total: ungraded.length, graded, failed: errors.length, errors },
      'Batch grading complete',
    );
  },
);

export const editGrade = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { courseId, id: assignmentId, submissionId } = req.validated?.params as {
      courseId: string;
      id: string;
      submissionId: string;
    };
    const body = req.validated?.body as {
      criterionFeedback: { criterion: string; maxPoints: number; awardedPoints: number; feedback: string }[];
      overallFeedback?: string | null;
      status?: 'draft' | 'approved';
    };
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Unauthorized');
    }

    const assignment = await findOwnedAssignment(courseId, assignmentId);
    const submission = await findOwnedSubmission(assignmentId, submissionId);

    const existingGrade = await gradeRepository.findBySubmissionId(submissionId);
    if (!existingGrade) {
      throw new ApiError(404, 'No grade exists yet for this submission — run AI grading first');
    }

    // maxPoints is always taken from the assignment's own rubric, never the
    // client — the same integrity rule as the AI grading path.
    const criterionFeedback: CriterionFeedback[] = body.criterionFeedback.map((c) => {
      const rubricCriterion = assignment.rubric.find(
        (r) => r.criterion.trim().toLowerCase() === c.criterion.trim().toLowerCase(),
      );
      const maxPoints = rubricCriterion?.maxPoints ?? c.maxPoints;
      return {
        criterion: c.criterion,
        maxPoints,
        awardedPoints: Math.min(Math.max(c.awardedPoints, 0), maxPoints),
        feedback: c.feedback,
      };
    });
    const score = criterionFeedback.reduce((sum, c) => sum + c.awardedPoints, 0);
    const status = body.status ?? existingGrade.status;

    const grade = await gradeRepository.update(existingGrade.id, {
      score,
      criterionFeedback,
      overallFeedback: body.overallFeedback ?? existingGrade.overallFeedback,
      status,
      approvedBy: status === GRADE_STATUS.APPROVED ? teacherId : null,
    });
    if (!grade) {
      throw new ApiError(404, 'Grade not found');
    }

    if (existingGrade.status !== GRADE_STATUS.APPROVED && status === GRADE_STATUS.APPROVED) {
      await notificationRepository.create({
        userId: submission.studentId,
        type: 'assignment_graded',
        title: `Assignment graded: ${assignment.title}`,
        body: `Score: ${score}/${assignment.rubric.reduce((sum, c) => sum + c.maxPoints, 0)}`,
        link: `/student/courses/${courseId}/assignments/${assignmentId}`,
      });

      // Fire-and-forget: new grade evidence may change the student's weak
      // areas — mark the current week's plan stale if one exists.
      void studyPlanRepository.markPlanStaleIfCurrentWeek(
        submission.studentId,
        `Your assignment "${assignment.title}" was graded. Your plan may no longer reflect your current performance.`,
      );
    }

    return ok(res, serializeGrade(grade), 'Grade updated');
  },
);
