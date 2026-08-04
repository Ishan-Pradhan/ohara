import type { Document } from '../models/documents.model.js';

// storageKey is a filesystem path — never returned to the client.
export const serializeDocument = (d: Document) => ({
  id: d.id,
  courseId: d.courseId,
  uploadedBy: d.uploadedBy,
  filename: d.filename,
  status: d.status,
  errorMessage: d.errorMessage,
  createdAt: d.createdAt,
});
