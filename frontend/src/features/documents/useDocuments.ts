import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchDocuments,
  fetchViewableDocuments,
  uploadDocument,
  deleteDocument,
  setKnowledgeBaseDocument,
  setSyllabusDocument,
} from './documents.api.js';
import type { Document } from './documents.schema.js';
import { COURSES_KEY } from '../institution/useInstitution.js';
import { TEACHER_COURSES_KEY } from '../teacher/useTeacher.js';

const POLL_INTERVAL_MS = 3000;

export const documentsKey = (courseId: string) => ['documents', courseId] as const;
export const viewableDocumentsKey = (courseId: string) => ['documents', 'viewable', courseId] as const;

export const useDocuments = (courseId: string) =>
  useQuery({
    queryKey: documentsKey(courseId),
    queryFn: () => fetchDocuments(courseId),
    enabled: Boolean(courseId),
    // Ingestion runs in the background on the server (upload responds
    // before it's done) — keep polling only while something is still
    // processing, so an idle course's document list doesn't poll forever.
    refetchInterval: (query) => {
      const documents = query.state.data as Document[] | undefined;
      const stillProcessing = documents?.some((d) => d.status === 'processing');
      return stillProcessing ? POLL_INTERVAL_MS : false;
    },
  });

export const useUploadDocument = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadDocument(courseId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKey(courseId) }),
  });
};

export const useDeleteDocument = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(courseId, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentsKey(courseId) }),
  });
};

/** Student-facing: only status: 'ready' documents, once the course is
 * published. No polling — unlike useDocuments, students aren't watching
 * something they just uploaded finish processing. */
export const useViewableDocuments = (courseId: string) =>
  useQuery({
    queryKey: viewableDocumentsKey(courseId),
    queryFn: () => fetchViewableDocuments(courseId),
    enabled: Boolean(courseId),
  });

export const useSetKnowledgeBaseDocument = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string | null) => setKnowledgeBaseDocument(courseId, documentId),
    // knowledgeBaseDocumentId lives on the course object, not the document
    // — invalidate both course-list caches (admin's and the teacher's own,
    // which are separate query keys for the same underlying data) rather
    // than documentsKey.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: COURSES_KEY });
      void qc.invalidateQueries({ queryKey: TEACHER_COURSES_KEY });
    },
  });
};

/** Independent of useSetKnowledgeBaseDocument — same invalidation shape
 * (syllabusDocumentId also lives on the course object), different field. */
export const useSetSyllabusDocument = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string | null) => setSyllabusDocument(courseId, documentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: COURSES_KEY });
      void qc.invalidateQueries({ queryKey: TEACHER_COURSES_KEY });
    },
  });
};
