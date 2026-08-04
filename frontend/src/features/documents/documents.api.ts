import { z } from 'zod';

import { api } from '../../lib/axios.js';
import { documentSchema, type Document } from './documents.schema.js';

export const fetchDocuments = async (courseId: string): Promise<Document[]> => {
  const res = await api.get(`/courses/${courseId}/documents`);
  return z.array(documentSchema).parse(res.data.data);
};

export const uploadDocument = async (courseId: string, file: File): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await api.post(`/courses/${courseId}/documents`, formData, {
    // Overrides the instance's default application/json header so the
    // browser sets multipart/form-data with the correct boundary itself.
    headers: { 'Content-Type': undefined },
  });
  return documentSchema.parse(res.data.data);
};

export const deleteDocument = async (courseId: string, documentId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/documents/${documentId}`);
};
