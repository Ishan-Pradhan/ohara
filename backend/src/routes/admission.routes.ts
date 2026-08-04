import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { admitStudentSchema } from '../validations/admission.validation.js';
import { admitStudent } from '../controllers/admission.controller.js';

const router = Router();

router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

router.route('/students/admit').post(validate(admitStudentSchema), admitStudent);

export default router;
