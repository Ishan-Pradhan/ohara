import { Router } from 'express';
import { verifyJWT, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { assignmentGradingLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  createCopilotConversationSchema,
  getCopilotConversationsSchema,
  getCopilotConversationSchema,
  sendCopilotMessageSchema,
  deleteCopilotConversationSchema,
} from '../validations/teacherCopilot.validation.js';
import {
  createCopilotConversation,
  getCopilotConversations,
  getCopilotConversation,
  sendCopilotMessage,
  deleteCopilotConversation,
} from '../controllers/teacherCopilot.controller.js';

const router = Router();

router
  .route('/:courseId/copilot/conversations')
  .get(verifyJWT, requireCourseTeacher, validate(getCopilotConversationsSchema), getCopilotConversations)
  .post(verifyJWT, requireCourseTeacher, validate(createCopilotConversationSchema), createCopilotConversation);

router
  .route('/:courseId/copilot/conversations/:conversationId')
  .get(verifyJWT, requireCourseTeacher, validate(getCopilotConversationSchema), getCopilotConversation)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteCopilotConversationSchema), deleteCopilotConversation);

router
  .route('/:courseId/copilot/conversations/:conversationId/messages')
  .post(
    verifyJWT,
    requireCourseTeacher,
    assignmentGradingLimiter,
    validate(sendCopilotMessageSchema),
    sendCopilotMessage,
  );

export default router;
