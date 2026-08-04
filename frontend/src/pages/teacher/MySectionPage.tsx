import { useState } from 'react';
import { Flag, LayoutGrid } from 'lucide-react';

import { useMySection, useSectionRoster } from '../../features/teacher/useTeacher.js';
import type { RosterStudent } from '../../features/teacher/teacher.schema.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { FlagStudentDialog } from './FlagStudentDialog.js';

export const MySectionPage = () => {
  const { data: section, isLoading: sectionLoading } = useMySection();
  const { data: students, isLoading: rosterLoading } = useSectionRoster(section?.id ?? '');
  const [flagging, setFlagging] = useState<RosterStudent | null>(null);

  const isLoading = sectionLoading || (Boolean(section) && rosterLoading);

  return (
    <AppShell>
      <PageHeader
        title={
          section
            ? `${section.programName ?? '—'} · ${section.className ?? '—'} · Section ${section.name}`
            : 'My Section'
        }
        description={
          section
            ? 'Students placed in this section for the current academic year.'
            : 'The section you are the class teacher for.'
        }
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : !section ? (
        <EmptyState
          icon={LayoutGrid}
          title="You're not a class teacher yet"
          description="An admin assigns a class teacher when creating or editing a section."
        />
      ) : !students || students.length === 0 ? (
        <EmptyState icon={LayoutGrid} title="No students placed in this section yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((student) => (
            <Card key={student.id} padding="sm" className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={student.name} src={student.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{student.name}</p>
                  <p className="truncate text-xs text-muted">{student.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>{student.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setFlagging(student)}>
                  <Flag className="size-4" aria-hidden />
                  Flag
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {flagging && section ? (
        <FlagStudentDialog
          studentId={flagging.id}
          studentName={flagging.name}
          sectionId={section.id}
          open={Boolean(flagging)}
          onOpenChange={(open) => !open && setFlagging(null)}
        />
      ) : null}
    </AppShell>
  );
};
