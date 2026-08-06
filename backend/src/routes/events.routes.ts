import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { createEventSchema, listMyEventsSchema, deleteEventSchema } from '../validations/events.validation.js';
import { createEvent, listMyEvents, deleteEvent } from '../controllers/events.controller.js';

const router = Router();

router.use(verifyJWT);

router.post(
  '/',
  requireRole(USER_ROLES.ADMIN, USER_ROLES.TEACHER),
  validate(createEventSchema),
  createEvent,
);
router.get('/me', validate(listMyEventsSchema), listMyEvents);
router.delete('/:id', validate(deleteEventSchema), deleteEvent);

export default router;
