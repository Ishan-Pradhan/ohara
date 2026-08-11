import { Router } from 'express';
import { verifyJWT, requireCourseAccess } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { getAttendanceTrendsSchema } from '../validations/attendanceTrends.validation.js';
import { getAttendanceTrends } from '../controllers/attendanceTrends.controller.js';

const router = Router();

router
  .route('/:courseId/attendance-trends')
  .get(verifyJWT, requireCourseAccess, validate(getAttendanceTrendsSchema), getAttendanceTrends);

export default router;
