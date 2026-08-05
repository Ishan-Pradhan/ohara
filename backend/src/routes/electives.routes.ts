import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { enrollInElectiveSchema, dropElectiveSchema } from '../validations/electives.validation.js';
import { enrollInElective, dropElective } from '../controllers/electives.controller.js';

// Mounted at /api/v1/courses, not /admin — same reasoning as
// documents.routes.ts / courseContent.routes.ts / tutor.routes.ts.
const router = Router();

router.use(verifyJWT, requireRole(USER_ROLES.STUDENT));

router
  .route('/:courseId/enroll')
  .post(validate(enrollInElectiveSchema), enrollInElective)
  .delete(validate(dropElectiveSchema), dropElective);

export default router;
