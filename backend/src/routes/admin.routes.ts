import { Router } from 'express';
import {
  blockAndUnblockUser,
  createStaff,
  getAllUsers,
  getUserStats,
  archiveUser,
  hardDeleteUser,
  inviteUsersBatch,
} from '../controllers/admin.controller.js';
import { requireRole, verifyJWT } from '../middlewares/auth.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  getAllUsersSchema,
  toggleBlockUserSchema,
  archiveUserSchema,
  hardDeleteUserSchema,
  createStaffSchema,
  inviteUsersBatchSchema,
} from '../validations/admin.validation.js';

const router = Router();

router
  .route('/users')
  .get(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(getAllUsersSchema),
    getAllUsers,
  )
  .post(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(createStaffSchema),
    createStaff,
  );

router
  .route('/users/batch')
  .post(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(inviteUsersBatchSchema),
    inviteUsersBatch,
  );

router.route('/stats').get(verifyJWT, requireRole(USER_ROLES.ADMIN), getUserStats);

router
  .route('/toggle-block/:id')
  .patch(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(toggleBlockUserSchema),
    blockAndUnblockUser,
  );

router
  .route('/users/:id/archive')
  .patch(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(archiveUserSchema),
    archiveUser,
  );

router
  .route('/users/:id')
  .delete(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(hardDeleteUserSchema),
    hardDeleteUser,
  );

export default router;
