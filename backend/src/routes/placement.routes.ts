import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import {
  createClassMembershipSchema,
  listClassMembershipsSchema,
} from '../validations/placement.validation.js';
import {
  createClassMembership,
  listClassMemberships,
} from '../controllers/placement.controller.js';

const router = Router();

// Every route in this file is admin-only.
router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

router
  .route('/class-memberships')
  .post(validate(createClassMembershipSchema), createClassMembership)
  .get(validate(listClassMembershipsSchema), listClassMemberships);

export default router;
