import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchDocuments, uploadDocument, deleteDocument } from './documents.api.js';
import type { Document } from './documents.schema.js';

const POLL_INTERVAL_MS = 3000;

export const documentsKey = (courseId: string) => ['documents', courseId] as const;

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
