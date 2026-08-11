import { Router } from 'express';
import { verifyJWT, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { assignmentGradingLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  createInterventionSchema,
  generateInterventionSchema,
  getInterventionsSchema,
  getInterventionSchema,
  updateInterventionSchema,
  resolveInterventionSchema,
  deleteInterventionSchema,
  getInterventionOutcomeSchema,
} from '../validations/intervention.validation.js';
import {
  createIntervention,
  generateInterventionPlan,
  getInterventions,
  getIntervention,
  updateIntervention,
  resolveIntervention,
  deleteIntervention,
  getInterventionOutcome,
} from '../controllers/intervention.controller.js';

const router = Router();

router
  .route('/:courseId/interventions')
  .get(verifyJWT, requireCourseTeacher, validate(getInterventionsSchema), getInterventions)
  .post(verifyJWT, requireCourseTeacher, validate(createInterventionSchema), createIntervention);

router
  .route('/:courseId/interventions/generate/:studentId')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(generateInterventionSchema),
    generateInterventionPlan,
  );

router
  .route('/:courseId/interventions/:id')
  .get(verifyJWT, requireCourseTeacher, validate(getInterventionSchema), getIntervention)
  .patch(verifyJWT, requireCourseTeacher, validate(updateInterventionSchema), updateIntervention)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteInterventionSchema), deleteIntervention);

router
  .route('/:courseId/interventions/:id/resolve')
  .patch(verifyJWT, requireCourseTeacher, validate(resolveInterventionSchema), resolveIntervention);

router
  .route('/:courseId/interventions/:id/outcome')
  .get(verifyJWT, requireCourseTeacher, validate(getInterventionOutcomeSchema), getInterventionOutcome);

export default router;
