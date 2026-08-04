import { useRef, useState } from 'react';
import { FileText, Sparkles, Trash2, Upload } from 'lucide-react';

import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
} from '../../../features/documents/useDocuments.js';
import type { Document } from '../../../features/documents/documents.schema.js';
import { useGenerateStructure } from '../../../features/courseContent/useCourseContent.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { ConfirmDialog } from '../../../components/ui/Dialog.js';
import { Card } from '../../../components/ui/Card.js';

const statusVariant: Record<Document['status'], 'warning' | 'success' | 'danger'> = {
  processing: 'warning',
  ready: 'success',
  failed: 'danger',
};

interface DocumentsSectionProps {
  courseId: string;
}

export const DocumentsSection = ({ courseId }: DocumentsSectionProps) => {
  const { data: documents, isLoading } = useDocuments(courseId);
  const uploadDocument = useUploadDocument(courseId);
  const deleteDocument = useDeleteDocument(courseId);
  const generateStructure = useGenerateStructure(courseId);

  const [deleting, setDeleting] = useState<Document | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      await uploadDocument.mutateAsync(file);
      toast.success(`${file.name} uploaded — processing`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Upload failed');
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteDocument.mutateAsync(deleting.id);
    toast.success(`${deleting.filename} deleted`);
    setDeleting(null);
  };

  const onGenerate = async (documentId: string) => {
    setGeneratingId(documentId);
    try {
      const modules = await generateStructure.mutateAsync(documentId);
      toast.success(`Generated ${modules.length} module${modules.length === 1 ? '' : 's'}`);
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.message : 'Could not generate a structure',
      );
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-fg">Documents</h2>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onFileSelected}
        />
        <Button
          size="sm"
          loading={uploadDocument.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          Upload PDF
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !documents || documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload a course PDF to start generating a lesson structure from it."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((document) => (
            <Card key={document.id} padding="sm" className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{document.filename}</p>
                {document.status === 'failed' && document.errorMessage ? (
                  <p className="mt-0.5 truncate text-xs text-danger">{document.errorMessage}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={statusVariant[document.status]}>{document.status}</Badge>
                {document.status === 'ready' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={generatingId === document.id}
                    disabled={generateStructure.isPending && generatingId !== document.id}
                    onClick={() => onGenerate(document.id)}
                  >
                    <Sparkles className="size-4" aria-hidden />
                    Generate structure
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${document.filename}`}
                  onClick={() => setDeleting(document)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this document?"
        description={`${deleting?.filename} and its extracted chunks will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteDocument.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
