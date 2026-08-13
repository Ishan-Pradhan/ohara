import { Router } from 'express';
import { verifyJWT, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  generateStructureSchema,
  listModulesSchema,
  createModuleSchema,
  updateModuleSchema,
  deleteModuleSchema,
  createLessonSchema,
  updateLessonSchema,
  deleteLessonSchema,
  publishCourseSchema,
  listCourseBatchesSchema,
} from '../validations/courseContent.validation.js';
import {
  generateCourseStructure,
  listModules,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
  publishCourse,
  listCourseBatches,
} from '../controllers/courseContent.controller.js';

// Mounted at /api/v1/courses — see documents.routes.ts for why this isn't
// under /api/v1/admin.
const router = Router();

router
  .route('/:courseId/documents/:documentId/generate')
  .post(
    verifyJWT,
    requireCourseTeacher,
    validate(generateStructureSchema),
    generateCourseStructure,
  );

router
  .route('/:courseId/modules')
  .get(verifyJWT, requireCourseTeacher, validate(listModulesSchema), listModules)
  .post(verifyJWT, requireCourseTeacher, validate(createModuleSchema), createModule);

router
  .route('/:courseId/modules/:id')
  .patch(verifyJWT, requireCourseTeacher, validate(updateModuleSchema), updateModule)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteModuleSchema), deleteModule);

router
  .route('/:courseId/modules/:moduleId/lessons')
  .post(verifyJWT, requireCourseTeacher, validate(createLessonSchema), createLesson);

router
  .route('/:courseId/modules/:moduleId/lessons/:id')
  .patch(verifyJWT, requireCourseTeacher, validate(updateLessonSchema), updateLesson)
  .delete(verifyJWT, requireCourseTeacher, validate(deleteLessonSchema), deleteLesson);

router
  .route('/:courseId/publish')
  .patch(verifyJWT, requireCourseTeacher, validate(publishCourseSchema), publishCourse);

router
  .route('/:courseId/batches')
  .get(verifyJWT, requireCourseTeacher, validate(listCourseBatchesSchema), listCourseBatches);

export default router;
