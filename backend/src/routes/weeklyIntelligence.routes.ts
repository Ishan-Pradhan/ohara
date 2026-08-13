import { Router } from 'express';

import { getWeeklySummary, generateWeeklySummaryInsights } from '../controllers/weeklyIntelligence.controller.js';
import {
  getWeeklySummarySchema,
  generateWeeklySummaryInsightsSchema,
} from '../validations/weeklyIntelligence.validation.js';
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

router.post(
  '/:courseId/weekly-intelligence/insights',
  verifyJWT,
  requireCourseTeacher,
  validate(generateWeeklySummaryInsightsSchema),
  generateWeeklySummaryInsights,
);

export default router;
