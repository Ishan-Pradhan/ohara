import { Router } from 'express';
import {
  blockAndUnblockUser,
  createStaff,
  getAllUsers,
  getUserStats,
  archiveUser,
  restoreUser,
  hardDeleteUser,
  inviteUsersBatch,
  setDateOfBirth,
} from '../controllers/admin.controller.js';
import { listStudentFlags, resolveStudentFlag } from '../controllers/studentFlags.controller.js';
import {
  getInstitutionPerformance,
  generateInstitutionPerformanceInsights,
} from '../controllers/institutionPerformance.controller.js';
import {
  createCopilotConversation,
  getCopilotConversations,
  getCopilotConversation,
  sendCopilotMessage,
  deleteCopilotConversation,
} from '../controllers/adminCopilot.controller.js';
import {
  getInstitutionWeekly,
  generateInstitutionWeeklyInsights,
} from '../controllers/institutionWeekly.controller.js';
import { requireRole, verifyJWT } from '../middlewares/auth.middleware.js';
import { assignmentGradingLimiter } from '../middlewares/rateLimiter.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  getAllUsersSchema,
  toggleBlockUserSchema,
  archiveUserSchema,
  restoreUserSchema,
  hardDeleteUserSchema,
  createStaffSchema,
  inviteUsersBatchSchema,
  setDateOfBirthSchema,
} from '../validations/admin.validation.js';
import {
  listStudentFlagsSchema,
  resolveFlagSchema,
} from '../validations/teacher.validation.js';
import {
  getInstitutionPerformanceSchema,
  generateInstitutionPerformanceInsightsSchema,
} from '../validations/institutionPerformance.validation.js';
import {
  createCopilotConversationSchema,
  getCopilotConversationsSchema,
  getCopilotConversationSchema,
  sendCopilotMessageSchema,
  deleteCopilotConversationSchema,
} from '../validations/adminCopilot.validation.js';
import {
  getInstitutionWeeklySchema,
  generateInstitutionWeeklyInsightsSchema,
} from '../validations/institutionWeekly.validation.js';

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
  .route('/institution-performance')
  .get(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(getInstitutionPerformanceSchema),
    getInstitutionPerformance,
  );

router
  .route('/institution-performance/insights')
  .post(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(generateInstitutionPerformanceInsightsSchema),
    generateInstitutionPerformanceInsights,
  );

router
  .route('/copilot/conversations')
  .get(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(getCopilotConversationsSchema),
    getCopilotConversations,
  )
  .post(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(createCopilotConversationSchema),
    createCopilotConversation,
  );

router
  .route('/copilot/conversations/:conversationId')
  .get(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(getCopilotConversationSchema),
    getCopilotConversation,
  )
  .delete(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(deleteCopilotConversationSchema),
    deleteCopilotConversation,
  );

router
  .route('/copilot/conversations/:conversationId/messages')
  .post(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    assignmentGradingLimiter,
    validate(sendCopilotMessageSchema),
    sendCopilotMessage,
  );

router
  .route('/weekly-intelligence')
  .get(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(getInstitutionWeeklySchema),
    getInstitutionWeekly,
  );

router
  .route('/weekly-intelligence/insights')
  .post(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(generateInstitutionWeeklyInsightsSchema),
    generateInstitutionWeeklyInsights,
  );

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
  .route('/users/:id/restore')
  .patch(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(restoreUserSchema),
    restoreUser,
  );

router
  .route('/users/:id/date-of-birth')
  .patch(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(setDateOfBirthSchema),
    setDateOfBirth,
  );

router
  .route('/users/:id')
  .delete(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(hardDeleteUserSchema),
    hardDeleteUser,
  );

router
  .route('/students/:studentId/flags')
  .get(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(listStudentFlagsSchema),
    listStudentFlags,
  );

router
  .route('/student-flags/:id/resolve')
  .patch(
    verifyJWT,
    requireRole(USER_ROLES.ADMIN),
    validate(resolveFlagSchema),
    resolveStudentFlag,
  );

export default router;
