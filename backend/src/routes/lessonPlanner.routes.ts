import { Router } from 'express';
import { verifyJWT, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { assignmentGradingLimiter } from '../middlewares/rateLimiter.middleware.js';
import { generateLessonPlanSchema } from '../validations/lessonPlanner.validation.js';
import { generateLessonPlan } from '../controllers/lessonPlanner.controller.js';

const router = Router();

router
  .route('/:courseId/lesson-plan')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(generateLessonPlanSchema),
    generateLessonPlan,
  );

export default router;
