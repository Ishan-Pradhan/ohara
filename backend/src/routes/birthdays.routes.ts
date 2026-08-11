import { Router } from 'express';

import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { getTodayBirthdays, sendBirthdayWish } from '../controllers/birthdays.controller.js';
import { getTodayBirthdaysSchema, sendBirthdayWishSchema } from '../validations/birthdays.validation.js';

const router = Router();

router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

router.get('/birthdays/today', validate(getTodayBirthdaysSchema), getTodayBirthdays);
router.post('/birthdays/wish', validate(sendBirthdayWishSchema), sendBirthdayWish);

export default router;
