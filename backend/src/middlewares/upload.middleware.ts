import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';

import { env } from '../config/env.js';
import { SUBMISSION_ALLOWED_MIME_TYPES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';

const pdfFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
) => {
  if (file.mimetype !== 'application/pdf') {
    cb(new ApiError(400, 'Only PDF files are allowed'));
    return;
  }
  cb(null, true);
};

// memoryStorage, not diskStorage: the controller writes the buffer to disk
// itself once it knows the document's id (the filename), rather than
// naming the file before the row exists.
export const uploadPdf = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_PDF_BYTES },
  fileFilter: pdfFileFilter,
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
// never touching local disk (Phase 5 uses Cloudinary, unlike uploadPdf above).
export const uploadSubmissionFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SUBMISSION_BYTES },
  fileFilter: submissionFileFilter,
}).single('file');
