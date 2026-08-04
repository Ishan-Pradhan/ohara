import { Router } from 'express';
import { verifyJWT, requireCourseTeacher } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { uploadPdf } from '../middlewares/upload.middleware.js';
import {
  uploadDocumentSchema,
  listDocumentsSchema,
  deleteDocumentSchema,
} from '../validations/documents.validation.js';
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
} from '../controllers/documents.controller.js';

const router = Router();

// Mounted at /api/v1/courses, not /api/v1/admin — every router mounted there
// (institution.routes.ts, placement.routes.ts, admin.routes.ts) applies a
// blanket `router.use(verifyJWT, requireRole(ADMIN))` to its whole prefix,
// which Express runs for any request under /api/v1/admin/* regardless of
// whether a specific route matches. That would block the teachers this
// route needs to allow (via requireCourseTeacher) before ever reaching this
// file — see students.routes.ts for the same reasoning.
router
  .route('/:courseId/documents')
  .post(
    verifyJWT,
    requireCourseTeacher,
    uploadPdf,
    validate(uploadDocumentSchema),
    uploadDocument,
  )
  .get(
    verifyJWT,
    requireCourseTeacher,
    validate(listDocumentsSchema),
    listDocuments,
  );

router
  .route('/:courseId/documents/:id')
  .delete(
    verifyJWT,
    requireCourseTeacher,
    validate(deleteDocumentSchema),
    deleteDocument,
  );

export default router;
