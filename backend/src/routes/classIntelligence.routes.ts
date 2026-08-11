import { Router } from 'express';
import { verifyJWT, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { getClassIntelligenceSchema } from '../validations/classIntelligence.validation.js';
import { getClassIntelligence } from '../controllers/classIntelligence.controller.js';

const router = Router();

router
  .route('/:courseId/class-intelligence')
  .get(verifyJWT, requireCourseTeacher, validate(getClassIntelligenceSchema), getClassIntelligence);

export default router;
