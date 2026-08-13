import { Router } from 'express';
import { verifyJWT, requireRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { USER_ROLES } from '../constants/index.js';
import {
  createProgramSchema,
  updateProgramSchema,
  deleteProgramSchema,
  createClassSchema,
  listClassesSchema,
  updateClassSchema,
  deleteClassSchema,
  createBatchSchema,
  listBatchesSchema,
  updateBatchSchema,
  deleteBatchSchema,
  getBatchCurrentPlacementSchema,
  createAcademicYearSchema,
  updateAcademicYearSchema,
  deleteAcademicYearSchema,
  createSectionSchema,
  listSectionsSchema,
  updateSectionSchema,
  deleteSectionSchema,
  createCourseSchema,
  listCoursesSchema,
  updateCourseSchema,
  deleteCourseSchema,
  assignCourseTeacherSchema,
  listCourseTeachersSchema,
  unassignCourseTeacherSchema,
} from '../validations/institution.validation.js';
import {
  createProgram,
  listPrograms,
  updateProgram,
  deleteProgram,
  createClass,
  listClasses,
  updateClass,
  deleteClass,
  createBatch,
  listBatches,
  updateBatch,
  deleteBatch,
  getBatchCurrentPlacement,
  createAcademicYear,
  listAcademicYears,
  updateAcademicYear,
  deleteAcademicYear,
  createSection,
  listSections,
  updateSection,
  deleteSection,
  createCourse,
  listCourses,
  updateCourse,
  deleteCourse,
  assignCourseTeacher,
  listCourseTeachers,
  unassignCourseTeacher,
} from '../controllers/institution.controller.js';

const router = Router();

// Every route in this file is admin-only.
router.use(verifyJWT, requireRole(USER_ROLES.ADMIN));

router
  .route('/programs')
  .post(validate(createProgramSchema), createProgram)
  .get(listPrograms);

router
  .route('/programs/:id')
  .patch(validate(updateProgramSchema), updateProgram)
  .delete(validate(deleteProgramSchema), deleteProgram);

router
  .route('/classes')
  .post(validate(createClassSchema), createClass)
  .get(validate(listClassesSchema), listClasses);

router
  .route('/classes/:id')
  .patch(validate(updateClassSchema), updateClass)
  .delete(validate(deleteClassSchema), deleteClass);

router
  .route('/batches')
  .post(validate(createBatchSchema), createBatch)
  .get(validate(listBatchesSchema), listBatches);

router
  .route('/batches/:id')
  .patch(validate(updateBatchSchema), updateBatch)
  .delete(validate(deleteBatchSchema), deleteBatch);

router
  .route('/batches/:id/current-placement')
  .get(validate(getBatchCurrentPlacementSchema), getBatchCurrentPlacement);

router
  .route('/academic-years')
  .post(validate(createAcademicYearSchema), createAcademicYear)
  .get(listAcademicYears);

router
  .route('/academic-years/:id')
  .patch(validate(updateAcademicYearSchema), updateAcademicYear)
  .delete(validate(deleteAcademicYearSchema), deleteAcademicYear);

router
  .route('/sections')
  .post(validate(createSectionSchema), createSection)
  .get(validate(listSectionsSchema), listSections);

router
  .route('/sections/:id')
  .patch(validate(updateSectionSchema), updateSection)
  .delete(validate(deleteSectionSchema), deleteSection);

router
  .route('/courses')
  .post(validate(createCourseSchema), createCourse)
  .get(validate(listCoursesSchema), listCourses);

router
  .route('/courses/:id')
  .patch(validate(updateCourseSchema), updateCourse)
  .delete(validate(deleteCourseSchema), deleteCourse);

router
  .route('/courses/:courseId/teachers')
  .post(validate(assignCourseTeacherSchema), assignCourseTeacher)
  .get(validate(listCourseTeachersSchema), listCourseTeachers);

router
  .route('/courses/:courseId/teachers/:teacherId')
  .delete(validate(unassignCourseTeacherSchema), unassignCourseTeacher);

export default router;
