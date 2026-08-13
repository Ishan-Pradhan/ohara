import { useRef, useState } from 'react';
import { FileText, Sparkles, Trash2, Upload, Eye, BookMarked, ScrollText, MoreVertical } from 'lucide-react';

import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
  useSetKnowledgeBaseDocument,
  useSetSyllabusDocument,
} from '../../../features/documents/useDocuments.js';
import { documentFileUrl } from '../../../features/documents/documents.api.js';
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
import { Tooltip } from '../../../components/ui/Tooltip.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/DropdownMenu.js';

const statusVariant: Record<Document['status'], 'warning' | 'success' | 'danger'> = {
  processing: 'warning',
  ready: 'success',
  failed: 'danger',
};

interface DocumentsSectionProps {
  courseId: string;
  /** Which document (if any) is this course's RAG source for the tutor and
   * quiz generation — Course.knowledgeBaseDocumentId. Passed down from the
   * parent page's already-loaded course object rather than fetched again
   * here. */
  knowledgeBaseDocumentId: string | null;
  /** Which document (if any) defines this course's official module/lesson
   * structure — Course.syllabusDocumentId. Independent of
   * knowledgeBaseDocumentId; a document can be either, both, or neither. */
  syllabusDocumentId: string | null;
}

export const DocumentsSection = ({
  courseId,
  knowledgeBaseDocumentId,
  syllabusDocumentId,
}: DocumentsSectionProps) => {
  const { data: documents, isLoading } = useDocuments(courseId);
  const uploadDocument = useUploadDocument(courseId);
  const deleteDocument = useDeleteDocument(courseId);
  const generateStructure = useGenerateStructure(courseId);
  const setKnowledgeBase = useSetKnowledgeBaseDocument(courseId);
  const setSyllabus = useSetSyllabusDocument(courseId);

  const [deleting, setDeleting] = useState<Document | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [settingKnowledgeBaseId, setSettingKnowledgeBaseId] = useState<string | null>(null);
  const [settingSyllabusId, setSettingSyllabusId] = useState<string | null>(null);
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

  const onToggleKnowledgeBase = async (document: Document) => {
    const isCurrent = document.id === knowledgeBaseDocumentId;
    setSettingKnowledgeBaseId(document.id);
    try {
      await setKnowledgeBase.mutateAsync(isCurrent ? null : document.id);
      toast.success(isCurrent ? 'Knowledge base cleared' : `${document.filename} set as knowledge base`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update the knowledge base');
    } finally {
      setSettingKnowledgeBaseId(null);
    }
  };

  const onToggleSyllabus = async (document: Document) => {
    const isCurrent = document.id === syllabusDocumentId;
    setSettingSyllabusId(document.id);
    try {
      await setSyllabus.mutateAsync(isCurrent ? null : document.id);
      toast.success(isCurrent ? 'Syllabus cleared' : `${document.filename} set as syllabus`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update the syllabus');
    } finally {
      setSettingSyllabusId(null);
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
          {documents.map((document) => {
            const isKnowledgeBase = document.id === knowledgeBaseDocumentId;
            const isSyllabus = document.id === syllabusDocumentId;
            const isBusy =
              settingKnowledgeBaseId === document.id ||
              settingSyllabusId === document.id ||
              generatingId === document.id;
            return (
            <Card key={document.id} padding="sm" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 basis-64">
                <p className="min-w-0 max-w-full truncate text-sm font-medium text-fg" title={document.filename}>
                  {document.filename}
                </p>
                {isKnowledgeBase ? (
                  <Badge variant="primary" className="shrink-0">Knowledge base</Badge>
                ) : null}
                {isSyllabus ? <Badge variant="primary" className="shrink-0">Syllabus</Badge> : null}
                {document.status === 'failed' && document.errorMessage ? (
                  <p className="w-full basis-full truncate text-xs text-danger">{document.errorMessage}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant={statusVariant[document.status]}>{document.status}</Badge>
                <Tooltip content="View">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`View ${document.filename}`}
                    onClick={() =>
                      window.open(documentFileUrl(courseId, document.id), '_blank', 'noopener,noreferrer')
                    }
                  >
                    <Eye className="size-4" aria-hidden />
                  </Button>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="rounded-control p-1.5 text-subtle transition-colors hover:bg-surface-hover hover:text-fg disabled:pointer-events-none disabled:opacity-50"
                    aria-label={`More actions for ${document.filename}`}
                    disabled={isBusy}
                  >
                    <MoreVertical className="size-4" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {document.status === 'ready' ? (
                      <>
                        <DropdownMenuItem onSelect={() => onToggleKnowledgeBase(document)}>
                          <BookMarked className="size-4" aria-hidden />
                          {isKnowledgeBase ? 'Clear knowledge base' : 'Set as knowledge base'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onToggleSyllabus(document)}>
                          <ScrollText className="size-4" aria-hidden />
                          {isSyllabus ? 'Clear syllabus' : 'Set as syllabus'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onGenerate(document.id)}>
                          <Sparkles className="size-4" aria-hidden />
                          Generate structure
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem destructive onSelect={() => setDeleting(document)}>
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
            );
          })}
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
