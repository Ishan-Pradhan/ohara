import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  getMyProfileSchema,
  updateMyProfileSchema,
} from '../validations/studentProfile.validation.js';
import { getMyProfile, updateMyProfile } from '../controllers/studentProfile.controller.js';

const router = Router();

router.use(verifyJWT);
router.use(requireRole('student'));

router
  .route('/me/profile')
  .get(validate(getMyProfileSchema), getMyProfile)
  .patch(validate(updateMyProfileSchema), updateMyProfile);

export default router;
