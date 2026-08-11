import { Router } from 'express';
import { verifyJWT, requireCourseAccess } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { getGradeTrendsSchema } from '../validations/gradeTrends.validation.js';
import { getGradeTrends } from '../controllers/gradeTrends.controller.js';

const router = Router();

router
  .route('/:courseId/grade-trends')
  .get(verifyJWT, requireCourseAccess, validate(getGradeTrendsSchema), getGradeTrends);

export default router;
