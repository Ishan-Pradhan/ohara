import { useState } from 'react';
import { ChevronLeft, ChevronRight, Layers, RotateCw } from 'lucide-react';

import { useFlashcards, useGenerateFlashcards } from '../../features/studyAids/useStudyAids.js';
import { useCurrentUser } from '../../features/auth/useAuth.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { cn } from '../../lib/cn.js';
import { Card } from '../ui/Card.js';
import { Button } from '../ui/Button.js';
import { Badge } from '../ui/Badge.js';
import { Skeleton } from '../ui/Skeleton.js';
import { EmptyState } from '../ui/EmptyState.js';
import { ConfirmDialog } from '../ui/Dialog.js';

interface FlashcardsSectionProps {
  courseId: string;
  lessonId?: string;
}

export const FlashcardsSection = ({ courseId, lessonId }: FlashcardsSectionProps) => {
  const { data: flashcards, isLoading } = useFlashcards(courseId, lessonId);
  const generate = useGenerateFlashcards(courseId, lessonId);
  const { data: currentUser } = useCurrentUser();
  const canRegenerate = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <Card padding="sm">
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  if (!flashcards) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={Layers}
          title="No flashcards yet"
          description={
            lessonId
              ? 'Generate a flashcard set to quiz yourself on this lesson.'
              : 'Generate a flashcard set to quiz yourself on this course.'
          }
          action={
            <Button size="sm" loading={generate.isPending} onClick={() => generate.mutate(undefined)}>
              <Layers className="size-4" aria-hidden />
              Generate flashcards
            </Button>
          }
        />
        {generate.isError ? (
          <p className="mt-3 text-center text-xs text-danger">
            {generate.error instanceof ApiError
              ? generate.error.message
              : "Couldn't generate flashcards — try again."}
          </p>
        ) : null}
      </Card>
    );
  }

  const cards = flashcards.content.cards;
  const card = cards[index];
  if (!card) return null;
  const progress = ((index + 1) / cards.length) * 100;

  const goTo = (next: number) => {
    setIndex(Math.max(0, Math.min(cards.length - 1, next)));
    setFlipped(false);
  };

  const onRegenerate = async () => {
    try {
      await generate.mutateAsync(true);
      setIndex(0);
      setFlipped(false);
      setConfirmOpen(false);
      toast.success('Flashcards regenerated');
    } catch {
      toast.error("Couldn't regenerate flashcards — try again.");
    }
  };

  return (
    <Card padding="sm">
      {canRegenerate ? (
        <div className="mb-3 flex items-center justify-end">
          <Button size="sm" variant="secondary" onClick={() => setConfirmOpen(true)}>
            <RotateCw className="size-3.5" aria-hidden />
            Regenerate
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Regenerate this flashcard set?"
        description="Every student studying this material sees the same flashcards. Regenerating replaces them for all of them immediately — anyone mid-review loses the set they were studying."
        confirmLabel="Regenerate"
        loading={generate.isPending}
        onConfirm={onRegenerate}
      />

      <div className="mb-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-hover">
          <div
            className="h-full rounded-pill bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-subtle">
          {index + 1} / {cards.length}
        </span>
      </div>

      <div className="perspective-distant">
        <button
          key={index}
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={
            flipped ? 'Showing the answer — click to see the question' : 'Showing the question — click to reveal the answer'
          }
          className={cn(
            'relative min-h-40 w-full transform-3d rounded-card transition-transform duration-500 ease-out',
            '[animation:pop-in_180ms_ease-out]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            flipped && 'rotate-y-180',
          )}
        >
          {/* Front — the question */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-card border border-primary/20 bg-primary-soft px-6 py-8 text-center backface-hidden">
            <Badge variant="primary">
              Question
              <RotateCw className="size-3" aria-hidden />
            </Badge>
            <p className="text-base font-medium text-fg">{card.front}</p>
          </div>

          {/* Back — the answer */}
          <div className="absolute inset-0 flex rotate-y-180 flex-col items-center justify-center gap-3 rounded-card border border-accent/30 bg-accent-soft px-6 py-8 text-center backface-hidden">
            <Badge variant="accent">Answer</Badge>
            <p className="text-base font-medium text-fg">{card.back}</p>
          </div>
        </button>
      </div>

      <p className="mt-2.5 text-center text-xs text-subtle">Click the card to flip it</p>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => goTo(index - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
          Prev
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={index === cards.length - 1}
          onClick={() => goTo(index + 1)}
        >
          Next
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </Card>
  );
};
