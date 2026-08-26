import { Router } from 'express';
import { verifyJWT, requireEnrolledStudent, requireCourseAccess } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { tutorLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  courseIdParamSchema,
  createConversationSchema,
  listMessagesSchema,
  sendMessageSchema,
  deleteConversationSchema,
  deleteMessageSchema,
} from '../validations/tutor.validation.js';
import {
  getCourseOutline,
  listConversations,
  createConversation,
  listMessages,
  sendMessage,
  deleteConversation,
  deleteMessage,
} from '../controllers/tutor.controller.js';

// Mounted at /api/v1/courses, not /api/v1/admin — same reasoning as
// documents.routes.ts / courseContent.routes.ts.
const router = Router();

router.use(verifyJWT);

// requireCourseAccess (not requireEnrolledStudent) — this outline also backs
// the study-aids scope picker (StudyAidsPanel), which a teacher or admin
// needs too, not just the tutor chat's own student-only UI. getCourseOutline
// itself still 404s on an unpublished course for a student; a teacher/admin
// managing their own course can see its draft structure.
router.get(
  '/:courseId/outline',
  requireCourseAccess,
  validate(courseIdParamSchema),
  getCourseOutline,
);

router
  .route('/:courseId/tutor/conversations')
  .get(requireEnrolledStudent, validate(courseIdParamSchema), listConversations)
  .post(requireEnrolledStudent, validate(createConversationSchema), createConversation);

router.delete(
  '/:courseId/tutor/conversations/:conversationId',
  requireEnrolledStudent,
  validate(deleteConversationSchema),
  deleteConversation,
);

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

router.delete(
  '/:courseId/tutor/conversations/:conversationId/messages/:messageId',
  requireEnrolledStudent,
  validate(deleteMessageSchema),
  deleteMessage,
);

export default router;
