import { Router } from 'express';
import { verifyJWT, requireRole, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import {
  listCourseStudentsSchema,
  listSectionStudentsSchema,
  createFlagSchema,
} from '../validations/teacher.validation.js';
import {
  listMyCourses,
  listCourseStudents,
  getMySection,
  listSectionStudents,
} from '../controllers/teacher.controller.js';
import { createStudentFlag } from '../controllers/studentFlags.controller.js';
import { getTeacherDashboard, generateTeacherDashboardInsights } from '../controllers/teacherDashboard.controller.js';
import {
  getTeacherDashboardSchema,
  generateTeacherDashboardInsightsSchema,
} from '../validations/teacherDashboard.validation.js';

// Mounted at /api/v1/teacher, not /api/v1/admin — see documents.routes.ts for
// why: the admin-mounted routers apply a blanket admin-only guard to their
// whole prefix, which would block the teachers these routes are for.
const router = Router();

router.use(verifyJWT);

router.get('/courses', requireRole(USER_ROLES.TEACHER), listMyCourses);

router.get('/dashboard', requireRole(USER_ROLES.TEACHER), validate(getTeacherDashboardSchema), getTeacherDashboard);
router.post(
  '/dashboard/insights',
  requireRole(USER_ROLES.TEACHER),
  validate(generateTeacherDashboardInsightsSchema),
  generateTeacherDashboardInsights,
);

router.get(
  '/courses/:courseId/students',
  requireCourseTeacher,
  validate(listCourseStudentsSchema),
  listCourseStudents,
);

router.get('/section', requireRole(USER_ROLES.TEACHER), getMySection);

router.get(
  '/section/:sectionId/students',
  requireRole(USER_ROLES.TEACHER, USER_ROLES.ADMIN),
  validate(listSectionStudentsSchema),
  listSectionStudents,
);

router.post(
  '/flags',
  requireRole(USER_ROLES.TEACHER),
  validate(createFlagSchema),
  createStudentFlag,
);

export default router;
