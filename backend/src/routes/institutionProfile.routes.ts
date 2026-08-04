import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { updateInstitutionProfileSchema } from '../validations/institutionProfile.validation.js';
import {
  getInstitutionProfile,
  updateInstitutionProfile,
} from '../controllers/institutionProfile.controller.js';

const router = Router();

// Public: the login screen and every role's dashboard need the institution's
// name without requiring a session first.
router.get('/institution-profile', getInstitutionProfile);

router.patch(
  '/institution-profile',
  verifyJWT,
  requireRole(USER_ROLES.ADMIN),
  validate(updateInstitutionProfileSchema),
  updateInstitutionProfile,
);

export default router;
