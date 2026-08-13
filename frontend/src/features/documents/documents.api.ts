import { z } from 'zod';

import { api, API_BASE_URL } from '../../lib/axios.js';
import { documentSchema, type Document } from './documents.schema.js';

export const fetchDocuments = async (courseId: string): Promise<Document[]> => {
  const res = await api.get(`/courses/${courseId}/documents`);
  return z.array(documentSchema).parse(res.data.data);
};

/** The student-facing counterpart to fetchDocuments: only status: 'ready'
 * documents, and only once the course is published (backend 404s otherwise
 * — same gate as the outline). */
export const fetchViewableDocuments = async (courseId: string): Promise<Document[]> => {
  const res = await api.get(`/courses/${courseId}/documents/viewable`);
  return z.array(documentSchema).parse(res.data.data);
};

/**
 * A plain URL, not an API call — for <a href>/<iframe src>, which the
 * browser navigates to directly rather than fetching through axios. Cookies
 * are same-origin either way (see lib/axios.ts), so no token needs
 * attaching here.
 */
export const documentFileUrl = (courseId: string, documentId: string): string =>
  `${API_BASE_URL}/courses/${courseId}/documents/${documentId}/file`;

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

/** documentId: null clears the selection. */
export const setKnowledgeBaseDocument = async (
  courseId: string,
  documentId: string | null,
): Promise<{ id: string; knowledgeBaseDocumentId: string | null }> => {
  const res = await api.patch(`/courses/${courseId}/knowledge-base`, { documentId });
  return res.data.data;
};

/** documentId: null clears the selection. Independent of
 * setKnowledgeBaseDocument — a course can have a syllabus document, a
 * knowledge-base document, both, or neither. */
export const setSyllabusDocument = async (
  courseId: string,
  documentId: string | null,
): Promise<{ id: string; syllabusDocumentId: string | null }> => {
  const res = await api.patch(`/courses/${courseId}/syllabus`, { documentId });
  return res.data.data;
};
