import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';

import { env } from '../config/env.js';
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
