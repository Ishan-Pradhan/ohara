import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { generateQuizSchema, type GenerateQuizInput } from '../../../features/quizzes/quizzes.schema.js';
import { useGenerateQuiz } from '../../../features/quizzes/useQuizzes.js';
import { useModules } from '../../../features/courseContent/useCourseContent.js';
import { ApiError } from '../../../lib/apiError.js';
import { toast } from '../../../lib/toast.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Button } from '../../../components/ui/Button.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { Textarea } from '../../../components/ui/Textarea.js';
import { Select } from '../../../components/ui/Select.js';
import { Checkbox } from '../../../components/ui/Checkbox.js';
import { Alert } from '../../../components/ui/Alert.js';

interface GenerateQuizDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (quizId: string) => void;
}

const COGNITIVE_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;

export const GenerateQuizDialog = ({
  courseId,
  open,
  onOpenChange,
  onGenerated,
}: GenerateQuizDialogProps) => {
  const generateQuiz = useGenerateQuiz(courseId);
  const { data: modules } = useModules(courseId);
  const lessons = (modules ?? []).flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));

  const [source, setSource] = useState<'lesson' | 'topic'>(lessons.length > 0 ? 'lesson' : 'topic');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedAllLessons, setSelectedAllLessons] = useState(false);

  const {
    register: field,
    handleSubmit,
    reset: resetForm,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GenerateQuizInput>({
    resolver: zodResolver(generateQuizSchema),
    defaultValues: {
      title: '',
      numQuestions: 5,
      types: ['mcq', 'short_answer'],
      difficulty: 'mixed',
      pointsPerQuestion: 1,
    },
  });
  const selectedTypes = watch('types');
  const lessonId = watch('lessonId');
  const difficulty = watch('difficulty');
  const cognitiveDist = watch('cognitiveDistribution');

  useEffect(() => {
    if (!open) return;
    resetForm({
      title: '',
      numQuestions: 5,
      types: ['mcq', 'short_answer'],
      difficulty: 'mixed',
      pointsPerQuestion: 1,
    });
    setShowAdvanced(false);
    setSelectedAllLessons(false);
  }, [open, resetForm]);

  // Switch to lesson source once modules load (handles race where dialog opens before query resolves)
  useEffect(() => {
    if (open && lessons.length > 0) {
      setSource('lesson');
    }
  }, [open, lessons.length]);

  const closeDialog = () => {
    onOpenChange(false);
    generateQuiz.reset();
  };

  const toggleType = (type: 'mcq' | 'short_answer', checked: boolean) => {
    const current = selectedTypes ?? [];
    setValue('types', checked ? [...current, type] : current.filter((t) => t !== type));
  };

  const setCognitiveLevel = (level: string, value: number) => {
    const current = cognitiveDist ?? {};
    setValue('cognitiveDistribution', { ...current, [level]: value });
  };

  const onSubmit = handleSubmit(async (values) => {
    const dist = values.cognitiveDistribution;
    const hasDist = dist && Object.values(dist).some((v) => v && v > 0);

    let payload: GenerateQuizInput;
    if (source === 'lesson') {
      if (selectedAllLessons) {
        payload = {
          title: values.title,
          numQuestions: values.numQuestions,
          types: values.types,
          difficulty: values.difficulty,
          pointsPerQuestion: values.pointsPerQuestion,
          learningObjectives: values.learningObjectives,
          lessonIds: lessons.map((l) => l.id),
          cognitiveDistribution: hasDist ? dist : undefined,
        };
      } else {
        payload = {
          title: values.title,
          numQuestions: values.numQuestions,
          types: values.types,
          difficulty: values.difficulty,
          pointsPerQuestion: values.pointsPerQuestion,
          learningObjectives: values.learningObjectives,
          lessonId: values.lessonId,
          cognitiveDistribution: hasDist ? dist : undefined,
        };
      }
    } else {
      payload = {
        title: values.title,
        numQuestions: values.numQuestions,
        types: values.types,
        difficulty: values.difficulty,
        pointsPerQuestion: values.pointsPerQuestion,
        learningObjectives: values.learningObjectives,
        topic: values.topic,
        cognitiveDistribution: hasDist ? dist : undefined,
      };
    }

    const quiz = await generateQuiz.mutateAsync(payload);
    toast.success(`Generated ${quiz.questions?.length ?? 0} questions`);
    closeDialog();
    onGenerated(quiz.id);
  });

  const lessonOptions = [
    { value: '__all__', label: `All lessons (${lessons.length})` },
    ...lessons.map((l) => ({ value: l.id, label: `${l.moduleTitle} — ${l.title}` })),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : closeDialog())}
      title="Generate a quiz"
      description="The AI drafts questions from course content or a topic — review and edit before publishing."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {generateQuiz.error instanceof ApiError ? <Alert>{generateQuiz.error.message}</Alert> : null}

        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <Input id="title" {...field('title')} />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Source</span>
          <div className="inline-flex gap-1 rounded-control bg-surface-hover p-1">
            <button
              type="button"
              className={`flex-1 rounded-[0.4rem] px-3 py-1.5 text-sm font-medium transition-colors ${source === 'lesson' ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}
              onClick={() => setSource('lesson')}
              disabled={lessons.length === 0}
            >
              From lesson
            </button>
            <button
              type="button"
              className={`flex-1 rounded-[0.4rem] px-3 py-1.5 text-sm font-medium transition-colors ${source === 'topic' ? 'bg-surface text-fg shadow-sm' : 'text-muted'}`}
              onClick={() => setSource('topic')}
            >
              Freeform topic
            </button>
          </div>
        </div>

        {source === 'lesson' ? (
          <Field label="Lesson" htmlFor="lessonId" error={errors.lessonId?.message}>
            <Select
              id="lessonId"
              value={selectedAllLessons ? '__all__' : lessonId}
              onValueChange={(value) => {
                if (value === '__all__') {
                  setSelectedAllLessons(true);
                  setValue('lessonId', undefined);
                } else {
                  setSelectedAllLessons(false);
                  setValue('lessonId', value);
                }
              }}
              placeholder="Choose a lesson…"
              options={lessonOptions}
            />
          </Field>
        ) : (
          <Field label="Topic" htmlFor="topic" error={errors.topic?.message} hint="What should the quiz cover?">
            <Textarea id="topic" rows={2} {...field('topic')} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Questions" htmlFor="numQuestions" error={errors.numQuestions?.message}>
            <Input
              id="numQuestions"
              type="number"
              min={1}
              max={20}
              {...field('numQuestions', { valueAsNumber: true })}
            />
          </Field>

          <Field label="Points each" htmlFor="pointsPerQuestion" error={errors.pointsPerQuestion?.message}>
            <Input
              id="pointsPerQuestion"
              type="number"
              min={1}
              max={100}
              {...field('pointsPerQuestion', { valueAsNumber: true })}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-fg">Question types</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-fg">
              <Checkbox
                checked={(selectedTypes ?? []).includes('mcq')}
                onCheckedChange={(checked) => toggleType('mcq', checked)}
              />
              Multiple choice
            </label>
            <label className="flex items-center gap-2 text-sm text-fg">
              <Checkbox
                checked={(selectedTypes ?? []).includes('short_answer')}
                onCheckedChange={(checked) => toggleType('short_answer', checked)}
              />
              Short answer
            </label>
          </div>
          {errors.types?.message ? (
            <p role="alert" className="text-sm text-danger">{errors.types.message}</p>
          ) : null}
        </div>

        <Field label="Difficulty" htmlFor="difficulty">
          <Select
            id="difficulty"
            value={difficulty}
            onValueChange={(v) => setValue('difficulty', v as 'easy' | 'medium' | 'hard' | 'mixed')}
            options={[
              { value: 'mixed', label: 'Mixed (default)' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
        </Field>

        {/* Advanced options toggle */}
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-fg transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          Advanced options
        </button>

        {showAdvanced && (
          <>
            <Field label="Learning objectives" htmlFor="learningObjectives" hint="One per line — the AI will align questions to these.">
              <Textarea
                id="learningObjectives"
                rows={3}
                placeholder={"Students will be able to:\n- Define Newton's laws\n- Apply formulas to solve problems"}
                onChange={(e) => {
                  const lines = e.target.value.split('\n').filter((l) => l.trim());
                  setValue('learningObjectives', lines.length > 0 ? lines : undefined);
                }}
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">Cognitive distribution (Bloom's taxonomy)</span>
              <p className="text-xs text-muted">Set how many questions at each level. Leave all at 0 for auto-distribution.</p>
              <div className="grid grid-cols-3 gap-2">
                {COGNITIVE_LEVELS.map((level) => (
                  <div key={level} className="flex items-center gap-2">
                    <label htmlFor={`cog-${level}`} className="text-xs text-muted capitalize w-16">{level}</label>
                    <Input
                      id={`cog-${level}`}
                      type="number"
                      min={0}
                      max={20}
                      className="w-16"
                      value={(cognitiveDist as Record<string, number> | undefined)?.[level] ?? 0}
                      onChange={(e) => setCognitiveLevel(level, parseInt(e.target.value) || 0)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={closeDialog}>
            Cancel
          </Button>
          <Button type="submit" loading={generateQuiz.isPending}>
            Generate
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
