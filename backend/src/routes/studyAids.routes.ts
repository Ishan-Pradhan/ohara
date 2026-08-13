import { Router } from 'express';
import { verifyJWT, requireEnrolledStudent } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { tutorLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  getStudyAidSchema,
  generateStudyAidSchema,
  explainConceptSchema,
} from '../validations/studyAids.validation.js';
import {
  getSummary,
  generateSummary,
  getFlashcards,
  generateFlashcards,
  explainConcept,
} from '../controllers/studyAids.controller.js';

// Mounted at /api/v1/courses, not /api/v1/admin — same reasoning as
// tutor.routes.ts / documents.routes.ts. Every route here is student-facing
// only (requireEnrolledStudent) — summary/flashcards/explain are study
// tools for the student consuming a course, not a teacher-authoring
// feature.
const router = Router();

router.use(verifyJWT);

router
  .route('/:courseId/study-aids/summary')
  .get(requireEnrolledStudent, validate(getStudyAidSchema), getSummary)
  .post(requireEnrolledStudent, tutorLimiter, validate(generateStudyAidSchema), generateSummary);

router
  .route('/:courseId/study-aids/flashcards')
  .get(requireEnrolledStudent, validate(getStudyAidSchema), getFlashcards)
  .post(requireEnrolledStudent, tutorLimiter, validate(generateStudyAidSchema), generateFlashcards);

router.post(
  '/:courseId/study-aids/explain',
  requireEnrolledStudent,
  tutorLimiter,
  validate(explainConceptSchema),
  explainConcept,
);

export default router;
