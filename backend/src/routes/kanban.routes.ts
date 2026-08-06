import { Router } from 'express';
import { verifyJWT, requireCourseTeacher, requireCourseAccess } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createProjectSchema,
  listProjectsSchema,
  getProjectSchema,
  deleteProjectSchema,
  createColumnSchema,
  updateColumnSchema,
  deleteColumnSchema,
  createTaskSchema,
  updateTaskSchema,
  deleteTaskSchema,
  moveTaskSchema,
} from '../validations/kanban.validation.js';
import {
  createProject,
  listProjects,
  getProject,
  deleteProject,
  createColumn,
  updateColumn,
  deleteColumn,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
} from '../controllers/kanban.controller.js';

// Mounted at /api/v1/courses — must be registered before electivesRoutes,
// same trap as assignments/quizzes/gradebook/attendance (see app.ts).
const router = Router();

router
  .route('/:courseId/projects')
  .post(verifyJWT, requireCourseTeacher, validate(createProjectSchema), createProject)
  .get(verifyJWT, requireCourseAccess, validate(listProjectsSchema), listProjects);

router
  .route('/:courseId/projects/:id')
  .get(verifyJWT, requireCourseAccess, validate(getProjectSchema), getProject)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteProjectSchema), deleteProject);

router
  .route('/:courseId/projects/:id/columns')
  .post(verifyJWT, requireCourseTeacher, validate(createColumnSchema), createColumn);

router
  .route('/:courseId/projects/:id/columns/:columnId')
  .patch(verifyJWT, requireCourseTeacher, validate(updateColumnSchema), updateColumn)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteColumnSchema), deleteColumn);

router
  .route('/:courseId/projects/:id/columns/:columnId/tasks')
  .post(verifyJWT, requireCourseTeacher, validate(createTaskSchema), createTask);

router
  .route('/:courseId/projects/:id/tasks/:taskId')
  .patch(verifyJWT, requireCourseTeacher, validate(updateTaskSchema), updateTask)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteTaskSchema), deleteTask);

router
  .route('/:courseId/projects/:id/tasks/:taskId/move')
  .patch(verifyJWT, requireCourseAccess, validate(moveTaskSchema), moveTask);

export default router;
