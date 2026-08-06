import { Router } from 'express';
import { verifyJWT, requireCourseTeacher, requireEnrolledStudent } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createAttendanceSessionSchema,
  listAttendanceSessionsSchema,
  getAttendanceSessionSchema,
  updateAttendanceSessionSchema,
  deleteAttendanceSessionSchema,
  getAttendanceSummarySchema,
  getMyAttendanceSchema,
} from '../validations/attendance.validation.js';
import {
  createAttendanceSession,
  listAttendanceSessions,
  getAttendanceSession,
  updateAttendanceSession,
  deleteAttendanceSession,
  getAttendanceSummary,
  getMyAttendance,
} from '../controllers/attendance.controller.js';

// Mounted at /api/v1/courses — must be registered before electivesRoutes,
// same trap as assignments/quizzes/gradebook (see app.ts).
const router = Router();

router
  .route('/:courseId/attendance/sessions')
  .post(verifyJWT, requireCourseTeacher, validate(createAttendanceSessionSchema), createAttendanceSession)
  .get(verifyJWT, requireCourseTeacher, validate(listAttendanceSessionsSchema), listAttendanceSessions);

router
  .route('/:courseId/attendance/sessions/:id')
  .get(verifyJWT, requireCourseTeacher, validate(getAttendanceSessionSchema), getAttendanceSession)
  .patch(verifyJWT, requireCourseTeacher, validate(updateAttendanceSessionSchema), updateAttendanceSession)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteAttendanceSessionSchema), deleteAttendanceSession);

router
  .route('/:courseId/attendance/summary')
  .get(verifyJWT, requireCourseTeacher, validate(getAttendanceSummarySchema), getAttendanceSummary);

router
  .route('/:courseId/attendance/me')
  .get(verifyJWT, requireEnrolledStudent, validate(getMyAttendanceSchema), getMyAttendance);

export default router;
