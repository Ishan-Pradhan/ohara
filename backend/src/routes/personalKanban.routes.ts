import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import {
  createMyTaskSchema,
  updateMyTaskSchema,
  deleteMyTaskSchema,
  moveMyTaskSchema,
} from '../validations/personalKanban.validation.js';
import {
  getOrCreateMyBoard,
  createMyTask,
  updateMyTask,
  deleteMyTask,
  moveMyTask,
} from '../controllers/personalKanban.controller.js';

// Mounted at /api/v1/me/kanban. Every student's own private, non-course
// board — student-only, no course scoping at all.
const router = Router();

router.use(verifyJWT, requireRole(USER_ROLES.STUDENT));

router.get('/board', getOrCreateMyBoard);
router.post('/columns/:columnId/tasks', validate(createMyTaskSchema), createMyTask);
router.patch('/tasks/:taskId', validate(updateMyTaskSchema), updateMyTask);
router.delete('/tasks/:taskId', validate(deleteMyTaskSchema), deleteMyTask);
router.patch('/tasks/:taskId/move', validate(moveMyTaskSchema), moveMyTask);

export default router;
