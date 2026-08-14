import { Router } from 'express';
import { verifyJWT, requireCourseAccess } from '../middlewares/auth.middleware.js';
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
// tutor.routes.ts / documents.routes.ts. Every route here uses
// requireCourseAccess (admin, assigned teacher, or enrolled student) rather
// than requireEnrolledStudent — a teacher/admin needs to reach these too, to
// preview them and to regenerate a summary/flashcard set
// (generateSummary/generateFlashcards enforce that regenerate is
// teacher/admin-only themselves, since it depends on the `regenerate` body
// flag, not the route). explain-a-concept has no shared state to clobber —
// it's never persisted — so opening it up to teachers/admins is harmless.
const router = Router();

router.use(verifyJWT);

router
  .route('/:courseId/study-aids/summary')
  .get(requireCourseAccess, validate(getStudyAidSchema), getSummary)
  .post(requireCourseAccess, tutorLimiter, validate(generateStudyAidSchema), generateSummary);

router
  .route('/:courseId/study-aids/flashcards')
  .get(requireCourseAccess, validate(getStudyAidSchema), getFlashcards)
  .post(requireCourseAccess, tutorLimiter, validate(generateStudyAidSchema), generateFlashcards);

router.post(
  '/:courseId/study-aids/explain',
  requireCourseAccess,
  tutorLimiter,
  validate(explainConceptSchema),
  explainConcept,
);

export default router;
