import { Router } from 'express';
import { verifyJWT, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { assignmentGradingLimiter } from '../middlewares/rateLimiter.middleware.js';
import { getAtRiskDashboardSchema, explainAtRiskSchema } from '../validations/atRisk.validation.js';
import { getAtRiskDashboard, explainAtRisk } from '../controllers/atRisk.controller.js';

// Mounted at /api/v1/courses — must be registered before electivesRoutes,
// same trap as every other course-scoped router (see app.ts).
const router = Router();

router
  .route('/:courseId/at-risk')
  .get(verifyJWT, requireCourseTeacher, validate(getAtRiskDashboardSchema), getAtRiskDashboard);

router
  .route('/:courseId/at-risk/:studentId/explain')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(explainAtRiskSchema),
    explainAtRisk,
  );

export default router;
