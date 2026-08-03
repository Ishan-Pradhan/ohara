import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { getStudentPlacementSchema } from '../validations/students.validation.js';
import { getStudentPlacement } from '../controllers/students.controller.js';

const router = Router();

// Authenticated, but NOT admin-only — see getStudentPlacement for the three-way check.
router.use(verifyJWT);

router.get('/:studentId/placement', validate(getStudentPlacementSchema), getStudentPlacement);

export default router;
