import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import { getStudentDashboard } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/me', verifyJWT, requireRole(USER_ROLES.STUDENT), getStudentDashboard);

export default router;
