import { Router } from 'express';

import { getWeeklySummary } from '../controllers/weeklyIntelligence.controller.js';
import { getWeeklySummarySchema } from '../validations/weeklyIntelligence.validation.js';
import { verifyJWT, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';

const router = Router({ mergeParams: true });

router.get(
  '/:courseId/weekly-intelligence',
  verifyJWT,
  requireCourseTeacher,
  validate(getWeeklySummarySchema),
  getWeeklySummary,
);

export default router;
