import { useState } from 'react';
import { BookOpen, Clock, Target, ListChecks, Lightbulb } from 'lucide-react';

import { useGenerateLessonPlan } from '../../../features/teacherIntelligence/useLessonPlanner.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Button } from '../../../components/ui/Button.js';
import { Field } from '../../../components/ui/Field.js';
import { Input } from '../../../components/ui/Input.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import type { LessonPlan } from '../../../features/teacherIntelligence/lessonPlanner.schema.js';

interface LessonPlannerPanelProps {
  courseId: string;
}

export const LessonPlannerPanel = ({ courseId }: LessonPlannerPanelProps) => {
  const generatePlan = useGenerateLessonPlan(courseId);
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(45);
  const [plan, setPlan] = useState<LessonPlan | null>(null);

  const onGenerate = async () => {
    if (!topic.trim()) return;
    try {
      const result = await generatePlan.mutateAsync({ topic: topic.trim(), durationMinutes: duration });
      setPlan(result);
    } catch {
      toast.error('Failed to generate lesson plan');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Topic" htmlFor="lesson-topic">
              <Input
                id="lesson-topic"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Introduction to Photosynthesis"
              />
            </Field>
          </div>
          <div className="w-32">
            <Field label="Duration (minutes)" htmlFor="lesson-duration">
              <Input
                id="lesson-duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min={10}
                max={300}
              />
            </Field>
          </div>
          <Button onClick={onGenerate} disabled={!topic.trim() || generatePlan.isPending}>
            {generatePlan.isPending ? 'Generating...' : 'Generate Plan'}
          </Button>
        </div>
      </Card>

      {generatePlan.isPending && (
        <Card padding="sm">
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Generating lesson plan...
          </div>
        </Card>
      )}

      {plan && !generatePlan.isPending && (
        <div className="flex flex-col gap-4">
          <Card padding="sm">
            <h3 className="mb-2 text-lg font-semibold">{plan.title}</h3>

            <div className="mb-4">
              <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                <Target className="size-4 text-primary" aria-hidden />
                Learning Objectives
              </h4>
              <ul className="ml-5 list-disc text-sm text-muted">
                {plan.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                <Clock className="size-4 text-primary" aria-hidden />
                Lesson Outline
              </h4>
              <div className="flex flex-col gap-1">
                {plan.outline.map((s, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="w-16 shrink-0 text-muted">{s.durationMinutes} min</span>
                    <span className="font-medium">{s.section}</span>
                    <span className="text-muted">— {s.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                <BookOpen className="size-4 text-primary" aria-hidden />
                Activities
              </h4>
              <div className="flex flex-col gap-1">
                {plan.activities.map((a, i) => (
                  <div key={i} className="flex gap-2 text-sm">
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {a.type}
                    </span>
                    <span className="font-medium">{a.name}</span>
                    <span className="text-muted">({a.durationMinutes} min) — {a.description}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-2">
              <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                <ListChecks className="size-4 text-primary" aria-hidden />
                Assessment Ideas
              </h4>
              <ul className="ml-5 list-disc text-sm text-muted">
                {plan.assessmentIdeas.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>

            {plan.materials && plan.materials.length > 0 && (
              <div>
                <h4 className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                  <Lightbulb className="size-4 text-primary" aria-hidden />
                  Materials
                </h4>
                <ul className="ml-5 list-disc text-sm text-muted">
                  {plan.materials.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      )}

      {!plan && !generatePlan.isPending && (
        <EmptyState
          icon={BookOpen}
          title="No lesson plan yet"
          description="Enter a topic and duration, then click Generate Plan."
        />
      )}
    </div>
  );
};
