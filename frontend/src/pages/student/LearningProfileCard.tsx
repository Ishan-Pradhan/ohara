import { AlertCircle, Brain, CheckCircle2, Target } from 'lucide-react';

import { useLearningProfile } from '../../features/dashboard/useLearningProfile.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { cn } from '../../lib/cn.js';

const sectionTitle = 'text-xs font-semibold uppercase tracking-wide text-subtle';

const BulletList = ({ items, tone }: { items: string[]; tone: 'success' | 'warning' | 'neutral' }) => {
  if (items.length === 0) {
    return <p className="px-1 text-sm text-muted">None yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-fg">
          <span
            className={cn(
              'mt-1.5 size-2 shrink-0 rounded-full',
                tone === 'success' && 'bg-success-soft',
                tone === 'warning' && 'bg-warning-soft',
                tone === 'neutral' && 'bg-border',
            )}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

export const LearningProfileCard = () => {
  const { data, isLoading, isError } = useLearningProfile();

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (isError || !data) {
    return (
      <Card padding="sm">
        <EmptyState
          icon={AlertCircle}
          title="Learning profile unavailable"
          description="The profile could not be loaded right now."
        />
      </Card>
    );
  }

  const { snapshot, profile } = data;

  return (
    <Card padding="sm" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-fg">Learning profile</h2>
          <p className="mt-1 text-sm text-muted">A grounded interpretation of your current academic evidence.</p>
        </div>
        <Badge variant={snapshot.status === 'ready' ? 'success' : 'neutral'}>
          {snapshot.status === 'ready' ? 'Ready' : 'Need more evidence'}
        </Badge>
      </div>

      <p className="rounded-card border border-border bg-surface px-3 py-2 text-sm text-fg">
        {profile.summary}
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-card border border-border bg-surface px-3 py-3">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            <span className={sectionTitle}>Strengths</span>
          </div>
          <BulletList items={profile.strengths} tone="success" />
        </div>

        <div className="rounded-card border border-border bg-surface px-3 py-3">
          <div className="mb-2 flex items-center gap-2">
            <Target className="size-4 text-warning" aria-hidden />
            <span className={sectionTitle}>Needs attention</span>
          </div>
          <BulletList items={profile.attentionAreas} tone="warning" />
        </div>

        <div className="rounded-card border border-border bg-surface px-3 py-3">
          <div className="mb-2 flex items-center gap-2">
            <Brain className="size-4 text-primary" aria-hidden />
            <span className={sectionTitle}>Next actions</span>
          </div>
          <BulletList items={profile.nextActions} tone="neutral" />
        </div>
      </div>

      <div>
        <p className={cn(sectionTitle, 'mb-2 flex items-center gap-2')}>
          <Brain className="size-4 text-muted" aria-hidden />
          Course insights
        </p>
        {profile.courseInsights.length === 0 ? (
          <p className="px-1 text-sm text-muted">No course insights yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.courseInsights.map((insight) => (
              <div key={insight.courseId} className="flex items-start justify-between gap-3 rounded-control bg-surface-hover px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{insight.courseTitle}</p>
                  <p className="mt-0.5 text-xs text-muted">{insight.note}</p>
                </div>
                <Badge
                  variant={
                    insight.status === 'strong'
                      ? 'success'
                      : insight.status === 'developing'
                        ? 'warning'
                        : insight.status === 'needs_attention'
                          ? 'danger'
                          : 'neutral'
                  }
                  className="shrink-0"
                >
                  {insight.status.replace('_', ' ')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
