import { Router } from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listNotificationsSchema,
  markNotificationReadSchema,
} from '../validations/notifications.validation.js';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notifications.controller.js';

const router = Router();

router.use(verifyJWT);

router.get('/', validate(listNotificationsSchema), listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', validate(markNotificationReadSchema), markNotificationRead);

export default router;
