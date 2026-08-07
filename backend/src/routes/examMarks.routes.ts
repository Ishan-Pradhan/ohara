import { Router } from 'express';
import { verifyJWT, requireCourseTeacher, requireRole } from '../middlewares/auth.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  getCourseExamMarksSchema,
  upsertCourseExamMarksSchema,
} from '../validations/examMarks.validation.js';
import {
  getBulkExamMarksSchema,
  upsertBulkExamMarksSchema,
} from '../validations/bulkExamMarks.validation.js';
import { getCourseExamMarks, upsertCourseExamMarks } from '../controllers/examMarks.controller.js';
import { getBulkExamMarks, upsertBulkExamMarks } from '../controllers/bulkExamMarks.controller.js';

// Mounted at /api/v1/courses — same reasoning as gradebook.routes.ts/attendance.routes.ts.
const router = Router();

router
  .route('/exam-marks/bulk')
  .get(verifyJWT, requireRole(USER_ROLES.ADMIN), validate(getBulkExamMarksSchema), getBulkExamMarks)
  .put(verifyJWT, requireRole(USER_ROLES.ADMIN), validate(upsertBulkExamMarksSchema), upsertBulkExamMarks);

router
  .route('/:courseId/exam-marks/:examTermId')
  .get(verifyJWT, requireCourseTeacher, validate(getCourseExamMarksSchema), getCourseExamMarks)
  .put(verifyJWT, requireCourseTeacher, validate(upsertCourseExamMarksSchema), upsertCourseExamMarks);

export default router;
