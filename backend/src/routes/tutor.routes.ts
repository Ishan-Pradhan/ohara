import { Router } from 'express';
import { verifyJWT, requireEnrolledStudent } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { tutorLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  courseIdParamSchema,
  createConversationSchema,
  listMessagesSchema,
  sendMessageSchema,
} from '../validations/tutor.validation.js';
import {
  getCourseOutline,
  listConversations,
  createConversation,
  listMessages,
  sendMessage,
} from '../controllers/tutor.controller.js';

// Mounted at /api/v1/courses, not /api/v1/admin — same reasoning as
// documents.routes.ts / courseContent.routes.ts.
const router = Router();

router.use(verifyJWT);

router.get(
  '/:courseId/outline',
  requireEnrolledStudent,
  validate(courseIdParamSchema),
  getCourseOutline,
);

router
  .route('/:courseId/tutor/conversations')
  .get(requireEnrolledStudent, validate(courseIdParamSchema), listConversations)
  .post(requireEnrolledStudent, validate(createConversationSchema), createConversation);

router.get(
  '/:courseId/tutor/conversations/:conversationId/messages',
  requireEnrolledStudent,
  validate(listMessagesSchema),
  listMessages,
);

router.post(
  '/:courseId/tutor/conversations/:conversationId/messages',
  requireEnrolledStudent,
  tutorLimiter,
  validate(sendMessageSchema),
  sendMessage,
);

export default router;
