import { useState } from 'react';
import { AlertTriangle, Plus, CheckCircle, Sparkles, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

import {
  useInterventions,
  useGenerateIntervention,
  useResolveIntervention,
  useDeleteIntervention,
  useInterventionOutcome,
} from '../../../features/teacherIntelligence/useIntervention.js';
import { useAtRiskDashboard } from '../../../features/atRisk/useAtRisk.js';
import { toast } from '../../../lib/toast.js';
import { Card } from '../../../components/ui/Card.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Button } from '../../../components/ui/Button.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { EmptyState } from '../../../components/ui/EmptyState.js';
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from '../../../components/ui/Table.js';
import { Dialog } from '../../../components/ui/Dialog.js';
import { Field } from '../../../components/ui/Field.js';
import { Textarea } from '../../../components/ui/Textarea.js';
import type { CreateInterventionInput } from '../../../features/teacherIntelligence/intervention.schema.js';
import { useCreateIntervention } from '../../../features/teacherIntelligence/useIntervention.js';

interface InterventionPanelProps {
  courseId: string;
}

const typeLabels: Record<string, string> = {
  ai_generated: 'AI Generated',
  manual: 'Manual',
  meeting: 'Meeting',
  tutoring: 'Tutoring',
  other: 'Other',
};

function TrendBadge({ trend, value }: { trend: string; value: number }) {
  const color = trend === 'improved' ? 'success' : trend === 'declined' ? 'danger' : 'neutral';
  return <Badge variant={color}>{trend} {value > 0 ? `(+${value})` : value < 0 ? `(${value})` : ''}</Badge>;
}

function OutcomeSection({ courseId, interventionId }: { courseId: string; interventionId: string }) {
  const { data: outcome, isLoading } = useInterventionOutcome(courseId, interventionId);

  if (isLoading) return <Skeleton className="h-8 w-full" />;
  if (!outcome?.hasOutcome || !outcome.metrics) return null;

  const { metrics } = outcome;
  return (
    <div className="mt-2 border-t pt-2 space-y-1">
      <p className="text-xs font-medium text-muted uppercase">Outcome Analysis</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span>Avg Grade:</span>
          <TrendBadge trend={metrics.averageGrade.trend} value={metrics.averageGrade.change} />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>Attendance:</span>
          <TrendBadge trend={metrics.attendancePercentage.trend} value={metrics.attendancePercentage.change} />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>Missing Subs:</span>
          <TrendBadge trend={metrics.missingSubmissions.trend} value={metrics.missingSubmissions.change} />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span>Late Subs:</span>
          <TrendBadge trend={metrics.lateSubmissions.trend} value={metrics.lateSubmissions.change} />
        </div>
      </div>
      {metrics.isAtRisk.resolved && (
        <p className="text-xs text-success">Student is no longer at risk.</p>
      )}
    </div>
  );
}

export const InterventionPanel = ({ courseId }: InterventionPanelProps) => {
  const { data: interventions, isLoading } = useInterventions(courseId);
  const { data: atRiskRows } = useAtRiskDashboard(courseId);
  const generateIntervention = useGenerateIntervention(courseId);
  const resolveIntervention = useResolveIntervention(courseId);
  const deleteIntervention = useDeleteIntervention(courseId);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const atRiskStudents = atRiskRows?.filter((r) => r.isAtRisk) ?? [];

  const onGenerate = async (studentId: string) => {
    setGeneratingFor(studentId);
    try {
      await generateIntervention.mutateAsync(studentId);
      toast.success('Intervention plan generated');
    } catch {
      toast.error('Failed to generate intervention plan');
    } finally {
      setGeneratingFor(null);
    }
  };

  const onResolve = async (id: string) => {
    try {
      await resolveIntervention.mutateAsync(id);
      toast.success('Intervention resolved');
    } catch {
      toast.error('Failed to resolve intervention');
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteIntervention.mutateAsync(id);
      toast.success('Intervention deleted');
    } catch {
      toast.error('Failed to delete intervention');
    }
  };

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {interventions?.length === 0
            ? 'No interventions logged yet.'
            : `${interventions?.length} intervention${interventions?.length === 1 ? '' : 's'} logged.`}
        </p>
        <div className="flex gap-2">
          {atRiskStudents.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
              <Plus className="size-3.5" aria-hidden />
              Log Action
            </Button>
          )}
        </div>
      </div>

      {/* Quick generate for at-risk students */}
      {atRiskStudents.length > 0 && (
        <Card padding="sm">
          <h4 className="mb-2 text-sm font-medium">Generate AI Intervention Plan</h4>
          <div className="flex flex-wrap gap-2">
            {atRiskStudents.map((s) => (
              <Button
                key={s.studentId}
                size="sm"
                variant="secondary"
                onClick={() => onGenerate(s.studentId)}
                loading={generatingFor === s.studentId}
              >
                <Sparkles className="size-3.5" aria-hidden />
                {s.studentName}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Interventions list */}
      {!interventions || interventions.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No interventions yet"
          description="Generate an AI intervention plan for an at-risk student or log a manual action."
        />
      ) : (
        <Card padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeadCell>Student</TableHeadCell>
                <TableHeadCell>Type</TableHeadCell>
                <TableHeadCell>Title</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {interventions.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.student?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={inv.type === 'ai_generated' ? 'accent' : 'neutral'}>
                      {typeLabels[inv.type] ?? inv.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{inv.title}</TableCell>
                  <TableCell>
                    <Badge variant={inv.status === 'resolved' ? 'success' : inv.status === 'dismissed' ? 'neutral' : 'warning'}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                      >
                        {expandedId === inv.id ? (
                          <ChevronUp className="size-3.5" aria-hidden />
                        ) : (
                          <ChevronDown className="size-3.5" aria-hidden />
                        )}
                      </Button>
                      {inv.status === 'active' && (
                        <Button variant="ghost" size="sm" onClick={() => onResolve(inv.id)}>
                          <CheckCircle className="size-3.5" aria-hidden />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onDelete(inv.id)}>
                        <Trash2 className="size-3.5 text-danger" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {expandedId && (() => {
                const inv = interventions.find((i) => i.id === expandedId);
                if (!inv) return null;
                return (
                  <TableRow key={`${expandedId}-detail`}>
                    <TableCell colSpan={5} className="bg-surface-hover/50">
                      <div className="flex flex-col gap-2 text-sm">
                        <p className="text-muted">{inv.notes}</p>
                        {inv.actions.length > 0 && (
                          <ul className="flex flex-col gap-1">
                            {inv.actions.map((a, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="font-medium">{a.description}</span>
                                <span className="text-muted">— {a.timeline}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {inv.status !== 'active' && (
                          <OutcomeSection courseId={courseId} interventionId={inv.id} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })()}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create intervention dialog */}
      {showCreate && (
        <CreateInterventionDialog
          courseId={courseId}
          atRiskStudents={atRiskStudents}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
};

const CreateInterventionDialog = ({
  courseId,
  atRiskStudents,
  onClose,
}: {
  courseId: string;
  atRiskStudents: Array<{ studentId: string; studentName: string }>;
  onClose: () => void;
}) => {
  const createIntervention = useCreateIntervention(courseId);
  const [form, setForm] = useState<CreateInterventionInput>({
    studentId: atRiskStudents[0]?.studentId ?? '',
    type: 'manual',
    title: '',
    notes: '',
    actions: [],
  });

  const onSubmit = async () => {
    if (!form.studentId || !form.title || !form.notes) return;
    try {
      await createIntervention.mutateAsync(form);
      toast.success('Intervention logged');
      onClose();
    } catch {
      toast.error('Failed to log intervention');
    }
  };

  return (
    <Dialog
      open
      onOpenChange={onClose}
      title="Log Intervention"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!form.studentId || !form.title || !form.notes || createIntervention.isPending}>
            Log Intervention
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Student" htmlFor="intervention-student">
          <select
            value={form.studentId}
            onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
            className="w-full rounded-card border border-border bg-surface px-3 py-2 text-sm text-fg"
          >
            {atRiskStudents.map((s) => (
              <option key={s.studentId} value={s.studentId}>
                {s.studentName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type" htmlFor="intervention-type">
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as CreateInterventionInput['type'],
              }))
            }
            className="w-full rounded-card border border-border bg-surface px-3 py-2 text-sm text-fg"
          >
            <option value="manual">Manual</option>
            <option value="meeting">Meeting</option>
            <option value="tutoring">Tutoring</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Title" htmlFor="intervention-title">
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Scheduled parent meeting"
            className="w-full rounded-card border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted"
          />
        </Field>
        <Field label="Notes" htmlFor="intervention-notes">
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Describe the action taken..."
            rows={3}
          />
        </Field>
      </div>
    </Dialog>
  );
};
