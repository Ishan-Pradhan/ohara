import multer, { type FileFilterCallback } from 'multer';
import type { Request } from 'express';

import { ApiError } from '../utils/ApiError.js';

const MAX_PDF_BYTES = 20 * 1024 * 1024;

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
  limits: { fileSize: MAX_PDF_BYTES },
  fileFilter: pdfFileFilter,
}).single('file');
