import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';

import { env } from '../config/env.js';
import { SUBMISSION_ALLOWED_MIME_TYPES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';

// Validated by extension, not file.mimetype: a browser/OS reports a wildly
// inconsistent MIME type for .md (text/markdown, text/plain, sometimes
// empty), so extension is the only reliable signal here. PDF is included in
// the same check for one consistent rule instead of two different ones.
const courseDocumentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (!/\.(pdf|md)$/i.test(file.originalname)) {
    cb(new ApiError(400, 'Only PDF or Markdown (.md) files are allowed'));
    return;
  }
  cb(null, true);
};

// memoryStorage, not diskStorage: the controller uploads the buffer to
// Cloudinary itself once it knows the document's id, rather than naming
// anything before the row exists.
export const uploadCourseDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_PDF_BYTES },
  fileFilter: courseDocumentFileFilter,
}).single('file');

const submissionFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (!SUBMISSION_ALLOWED_MIME_TYPES.includes(file.mimetype as never)) {
    cb(new ApiError(400, 'Unsupported file type — allowed: PDF, DOCX, XLSX, PNG, JPG'));
    return;
  }
  cb(null, true);
};

// memoryStorage: the controller uploads the buffer straight to Cloudinary,
// never touching local disk (Phase 5 uses Cloudinary, same as
// uploadCourseDocument above since the Cloudinary migration).
export const uploadSubmissionFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SUBMISSION_BYTES },
  fileFilter: submissionFileFilter,
}).single('file');
