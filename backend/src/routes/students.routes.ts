import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  getStudentPlacementSchema,
  getStudentPastCoursesSchema,
  getStudentElectivesSchema,
  getStudentAttendanceSchema,
} from '../validations/students.validation.js';
import { getTranscriptSchema, getTranscriptPdfSchema } from '../validations/transcript.validation.js';
import {
  getStudentPlacement,
  getStudentPastCourses,
  getStudentElectives,
  getStudentAttendance,
} from '../controllers/students.controller.js';
import { getTranscript, getTranscriptPdf } from '../controllers/transcript.controller.js';

const router = Router();

// Authenticated, but NOT admin-only — see getStudentPlacement for the three-way check.
router.use(verifyJWT);

router.get('/:studentId/placement', validate(getStudentPlacementSchema), getStudentPlacement);
router.get('/:studentId/past-courses', validate(getStudentPastCoursesSchema), getStudentPastCourses);
router.get('/:studentId/electives', validate(getStudentElectivesSchema), getStudentElectives);
router.get('/:studentId/attendance', validate(getStudentAttendanceSchema), getStudentAttendance);
router.get('/:studentId/transcript', validate(getTranscriptSchema), getTranscript);
router.get('/:studentId/transcript/pdf', validate(getTranscriptPdfSchema), getTranscriptPdf);

export default router;
