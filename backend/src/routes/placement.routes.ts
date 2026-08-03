import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import {
  createClassMembershipSchema,
  listClassMembershipsSchema,
  createEnrollmentSchema,
  listEnrollmentsSchema,
  transferClassMembershipSchema,
  setClassMembershipOutcomeSchema,
} from '../validations/placement.validation.js';
import {
  createClassMembership,
  listClassMemberships,
  createEnrollment,
  listEnrollments,
  transferClassMembership,
  setClassMembershipOutcome,
} from '../controllers/placement.controller.js';

const router = Router();

// Every route in this file is admin-only.
router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

router
  .route('/class-memberships')
  .post(validate(createClassMembershipSchema), createClassMembership)
  .get(validate(listClassMembershipsSchema), listClassMemberships);

router
  .route('/enrollments')
  .post(validate(createEnrollmentSchema), createEnrollment)
  .get(validate(listEnrollmentsSchema), listEnrollments);

router
  .route('/class-memberships/:id/transfer')
  .post(validate(transferClassMembershipSchema), transferClassMembership);

router
  .route('/class-memberships/:id/outcome')
  .post(validate(setClassMembershipOutcomeSchema), setClassMembershipOutcome);

export default router;
