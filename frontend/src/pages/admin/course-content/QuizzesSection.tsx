import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { HelpCircle, Plus, Sparkles, Trash2 } from 'lucide-react';

import { createQuizSchema, type CreateQuizInput, type Quiz } from '../../../features/quizzes/quizzes.schema.js';
import { useCreateQuiz, useDeleteQuiz, useQuizzes } from '../../../features/quizzes/useQuizzes.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Button } from '../../../components/ui/Button.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Card } from '../../../components/ui/Card.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { ConfirmDialog, Dialog } from '../../../components/ui/Dialog.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Alert } from '../../../components/ui/Alert.js';
import { GenerateQuizDialog } from './GenerateQuizDialog.js';

interface QuizzesSectionProps {
  courseId: string;
}

export const QuizzesSection = ({ courseId }: QuizzesSectionProps) => {
  const navigate = useNavigate();
  const { data: quizzes, isLoading } = useQuizzes(courseId);
  const createQuiz = useCreateQuiz(courseId);
  const deleteQuiz = useDeleteQuiz(courseId);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<Quiz | null>(null);

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<CreateQuizInput>({ resolver: zodResolver(createQuizSchema) });

  const closeCreate = () => {
    setCreateOpen(false);
    resetForm();
    createQuiz.reset();
  };

  const onCreate = handleSubmit(async (values) => {
    const quiz = await createQuiz.mutateAsync(values);
    toast.success('Quiz created');
    closeCreate();
    navigate(`/admin/courses/${courseId}/quizzes/${quiz.id}`);
  });

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteQuiz.mutateAsync(deleting.id);
    toast.success(`${deleting.title} deleted`);
    setDeleting(null);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-fg">Quizzes</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Blank quiz
          </Button>
          <Button size="sm" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="size-4" aria-hidden />
            Generate with AI
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !quizzes || quizzes.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No quizzes yet"
          description="Generate one from a lesson or a topic, or start with a blank quiz."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} padding="sm" className="flex items-center justify-between gap-3">
              <Link to={`/admin/courses/${courseId}/quizzes/${quiz.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg hover:underline">{quiz.title}</p>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={quiz.status === 'published' ? 'success' : 'neutral'}>{quiz.status}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Delete ${quiz.title}`}
                  onClick={() => setDeleting(quiz)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <GenerateQuizDialog
        courseId={courseId}
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerated={(quizId) => navigate(`/admin/courses/${courseId}/quizzes/${quizId}`)}
      />

      <Dialog open={createOpen} onOpenChange={(open) => (open ? setCreateOpen(true) : closeCreate())} title="Blank quiz">
        <form onSubmit={onCreate} className="flex flex-col gap-4" noValidate>
          {createQuiz.error instanceof ApiError ? <Alert>{createQuiz.error.message}</Alert> : null}
          <Field label="Title" htmlFor="quiz-title" error={errors.title?.message}>
            <Input id="quiz-title" {...field('title')} />
          </Field>
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" loading={createQuiz.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this quiz?"
        description={`${deleting?.title} and all its questions/attempts will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteQuiz.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
