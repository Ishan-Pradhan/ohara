import type { Document } from '../models/documents.model.js';

// storageKey/fileUrl/filePublicId are storage internals — never returned to
// the client. The file itself is only ever reached through
// GET .../documents/:id/file, which enforces the same course-access check on
// every request.
export const serializeDocument = (d: Document) => ({
  id: d.id,
  courseId: d.courseId,
  uploadedBy: d.uploadedBy,
  filename: d.filename,
  status: d.status,
  errorMessage: d.errorMessage,
  createdAt: d.createdAt,
});
