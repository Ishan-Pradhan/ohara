import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import {
  getStudentDashboard,
  getStudentLearningProfile,
  getStudentConceptInventory,
  getStudentMasteryReport,
  getStudentStudyPlan,
  generateStudentStudyPlan,
  toggleStudyPlanTask,
  deleteStudyPlanTask,
  addStudyPlanTask,
  getExamPrep,
} from '../controllers/dashboard.controller.js';
import {
  studyPlanTaskPositionSchema,
  addStudyPlanTaskBodySchema,
} from '../validations/dashboard.validation.js';
import { z } from '../validations/registry.js';

const router = Router();

router.get('/me', verifyJWT, requireRole(USER_ROLES.STUDENT), getStudentDashboard);
router.get(
  '/me/learning-profile',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  getStudentLearningProfile,
);
router.get(
  '/me/concepts',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  getStudentConceptInventory,
);
router.get(
  '/me/mastery',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  getStudentMasteryReport,
);
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

// Exam Prep (Slice 8) — deterministic readiness + AI explanation
router.get(
  '/me/exam-prep',
  verifyJWT,
  requireRole(USER_ROLES.STUDENT),
  getExamPrep,
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
