import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import {
  createExamTermSchema,
  listExamTermsSchema,
  deleteExamTermSchema,
} from '../validations/examTerms.validation.js';
import { createExamTerm, listExamTerms, deleteExamTerm } from '../controllers/examTerms.controller.js';

// Mounted at /api/v1/exam-terms. Listing is any authenticated role (teachers
// need to pick a term to enter marks against, students need term names to
// read their report card) — only create/delete are admin-only.
const router = Router();

router.use(verifyJWT);

router
  .route('/')
  .post(requireRole(USER_ROLES.ADMIN), validate(createExamTermSchema), createExamTerm)
  .get(validate(listExamTermsSchema), listExamTerms);

router.delete('/:id', requireRole(USER_ROLES.ADMIN), validate(deleteExamTermSchema), deleteExamTerm);

export default router;
