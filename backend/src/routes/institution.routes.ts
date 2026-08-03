import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { createProgramSchema } from '../validations/institution.validation.js';
import { createProgram, listPrograms } from '../controllers/institution.controller.js';

const router = Router();

// Every route in this file is admin-only.
router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

router
  .route('/programs')
  .post(validate(createProgramSchema), createProgram)
  .get(listPrograms);

export default router;
