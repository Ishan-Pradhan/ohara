import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import {
  getStudentDashboard,
  getStudentStudyPlan,
  generateStudentStudyPlan,
  toggleStudyPlanTask,
  deleteStudyPlanTask,
  addStudyPlanTask,
} from '../controllers/dashboard.controller.js';
import {
  studyPlanTaskPositionSchema,
  addStudyPlanTaskBodySchema,
} from '../validations/dashboard.validation.js';
import { z } from '../validations/registry.js';

const router = Router();

router.get('/me', verifyJWT, requireRole(USER_ROLES.STUDENT), getStudentDashboard);
router.get(
  '/me/study-plan',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  getStudentStudyPlan,
);
router.post(
  '/me/study-plan',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  generateStudentStudyPlan,
);

// Task mutations — operate on the active plan's content JSONB
router.patch(
  '/me/study-plan/tasks',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  validate({ body: studyPlanTaskPositionSchema.extend({ done: z.boolean() }) }),
  toggleStudyPlanTask,
);
router.delete(
  '/me/study-plan/tasks',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  validate({ body: studyPlanTaskPositionSchema }),
  deleteStudyPlanTask,
);
router.post(
  '/me/study-plan/tasks',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  validate({ body: addStudyPlanTaskBodySchema }),
  addStudyPlanTask,
);

export default router;
