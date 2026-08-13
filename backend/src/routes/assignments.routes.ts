import { Router } from 'express';
import {
  verifyJWT,
  requireCourseTeacher,
  requireEnrolledStudent,
  requireCourseAccess,
} from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { uploadSubmissionFile } from '../middlewares/upload.middleware.js';
import { assignmentGradingLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  createAssignmentSchema,
  listAssignmentsSchema,
  getAssignmentSchema,
  updateAssignmentSchema,
  deleteAssignmentSchema,
} from '../validations/assignments.validation.js';
import {
  submitSchema,
  getMySubmissionSchema,
  listSubmissionsSchema,
  gradeSubmissionSchema,
  gradeAllSchema,
  editGradeSchema,
} from '../validations/submissions.validation.js';
import {
  createAssignment,
  listAssignments,
  getAssignment,
  updateAssignment,
  deleteAssignment,
} from '../controllers/assignments.controller.js';
import {
  submitAssignment,
  getMySubmission,
  listSubmissions,
  gradeSubmission,
  gradeAllSubmissions,
  editGrade,
} from '../controllers/submissions.controller.js';

// Mounted at /api/v1/courses — see documents.routes.ts for why this isn't
// under /api/v1/admin.
const router = Router();

router
  .route('/:courseId/assignments')
  .post(verifyJWT, requireCourseTeacher, validate(createAssignmentSchema), createAssignment)
  .get(verifyJWT, requireCourseAccess, validate(listAssignmentsSchema), listAssignments);

router
  .route('/:courseId/assignments/:id')
  .get(verifyJWT, requireCourseAccess, validate(getAssignmentSchema), getAssignment)
  .patch(verifyJWT, requireCourseTeacher, validate(updateAssignmentSchema), updateAssignment)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteAssignmentSchema), deleteAssignment);

router
  .route('/:courseId/assignments/:id/submissions')
  .post(
    verifyJWT,
    requireEnrolledStudent,
    uploadSubmissionFile,
    validate(submitSchema),
    submitAssignment,
  )
  .get(verifyJWT, requireCourseTeacher, validate(listSubmissionsSchema), listSubmissions);

router
  .route('/:courseId/assignments/:id/submissions/me')
  .get(verifyJWT, requireCourseAccess, validate(getMySubmissionSchema), getMySubmission);

router
  .route('/:courseId/assignments/:id/submissions/:submissionId/grade')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(gradeSubmissionSchema),
    gradeSubmission,
  )
  .patch(verifyJWT, requireCourseTeacher, validate(editGradeSchema), editGrade);

router
  .route('/:courseId/assignments/:id/grade-all')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(gradeAllSchema),
    gradeAllSubmissions,
  );

export default router;
