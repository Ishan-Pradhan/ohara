import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';

import { createExamTermSchema, type CreateExamTermInput, type ExamTerm } from '../../../features/examMarks/examMarks.schema.js';
import { useExamTerms, useCreateExamTerm, useDeleteExamTerm } from '../../../features/examMarks/useExamMarks.js';
import { useAcademicYears } from '../../../features/institution/useInstitution.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Select } from '../../../components/ui/Select.js';
import { Alert } from '../../../components/ui/Alert.js';
import { Dialog, ConfirmDialog } from '../../../components/ui/Dialog.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';

/** Admin-only: create/delete the exam terms ("First Terminal", "Preboard",
 * "Re-exam") that teachers enter marks against. Small enough not to need
 * its own page — lives as a collapsible panel inside the report-card
 * workspace. */
export const ExamTermManager = () => {
  const { data: terms, isLoading } = useExamTerms();
  const { data: years } = useAcademicYears();
  const createTerm = useCreateExamTerm();
  const deleteTerm = useDeleteExamTerm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<ExamTerm | null>(null);

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateExamTermInput>({ resolver: zodResolver(createExamTermSchema) });

  const openCreate = () => {
    resetForm({ name: '', academicYearId: years?.find((y) => y.isCurrent)?.id ?? '' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    resetForm();
    createTerm.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    const created = await createTerm.mutateAsync(values);
    toast.success(`${created.name} created`);
    closeDialog();
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTerm.mutateAsync(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
    } catch (caught) {
      if (caught instanceof ApiError) toast.error(caught.message);
    }
  };

  const yearName = (id: string) => years?.find((y) => y.id === id)?.name ?? '—';

  return (
    <Card padding="sm">
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">Exam terms</h3>
        <Button size="sm" variant="secondary" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          New term
        </Button>
      </div>

      {isLoading ? null : !terms || terms.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No exam terms yet"
          description="Create one — e.g. First Terminal — before teachers can enter marks."
        />
      ) : (
        <div className="flex flex-wrap gap-2 px-1 py-1">
          {terms.map((term) => (
            <Badge key={term.id} variant="neutral" className="flex items-center gap-1.5 py-1.5 pl-2.5 pr-1.5">
              {term.name}
              <span className="text-subtle">· {yearName(term.academicYearId)}</span>
              <button
                type="button"
                aria-label={`Delete ${term.name}`}
                onClick={() => setDeleting(term)}
                className="rounded-full p-0.5 text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        title="New exam term"
        description="e.g. First Terminal, Preboard, Re-exam."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {createTerm.error instanceof ApiError ? <Alert>{createTerm.error.message}</Alert> : null}

          <Field label="Name" htmlFor="examTermName" error={errors.name?.message}>
            <Input id="examTermName" placeholder="e.g. First Terminal" {...field('name')} />
          </Field>

          <Controller
            control={control}
            name="academicYearId"
            render={({ field: yearField }) => (
              <Field label="Academic year" htmlFor="examTermYear" error={errors.academicYearId?.message}>
                <Select
                  id="examTermYear"
                  value={yearField.value}
                  onValueChange={yearField.onChange}
                  options={(years ?? []).map((y) => ({ value: y.id, label: y.name }))}
                  placeholder="Select an academic year"
                />
              </Field>
            )}
          />

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" loading={createTerm.isPending}>
              Create term
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this exam term?"
        description={`${deleting?.name} and every mark entered against it will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteTerm.isPending}
        onConfirm={confirmDelete}
      />
    </Card>
  );
};
