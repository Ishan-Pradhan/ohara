import { Router } from 'express';
import { verifyJWT, requireCourseTeacher, requireCourseAccess } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { getGradebookSchema, getMyGradesSchema } from '../validations/gradebook.validation.js';
import { getGradebook, getMyGrades } from '../controllers/gradebook.controller.js';

// Mounted at /api/v1/courses — see documents.routes.ts for why this isn't
// under /api/v1/admin, and app.ts for why it must be registered before
// electivesRoutes.
const router = Router();

router
  .route('/:courseId/gradebook')
  .get(verifyJWT, requireCourseTeacher, validate(getGradebookSchema), getGradebook);

router
  .route('/:courseId/gradebook/me')
  .get(verifyJWT, requireCourseAccess, validate(getMyGradesSchema), getMyGrades);

export default router;
