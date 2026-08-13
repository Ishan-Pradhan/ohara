import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Search } from 'lucide-react';

import { useMyStudents } from '../../features/teacher/useTeacher.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

const ALL_PROGRAMS = '__all__';

export const MyStudentsPage = () => {
  const navigate = useNavigate();
  const { data: students, isLoading } = useMyStudents();
  const [search, setSearch] = useState('');
  const [programId, setProgramId] = useState(ALL_PROGRAMS);

  const programOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of students ?? []) {
      if (s.programId && s.programName) seen.set(s.programId, s.programName);
    }
    return [
      { value: ALL_PROGRAMS, label: 'All programs' },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ];
  }, [students]);

  const filtered = (students ?? []).filter((s) => {
    if (programId !== ALL_PROGRAMS && s.programId !== programId) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  return (
    <AppShell>
      <PageHeader
        title="My Students"
        description="Every student across your courses, in one place."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" />
          <Input
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="max-w-xs">
          <Select value={programId} onValueChange={setProgramId} options={programOptions} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !students || students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students yet"
          description="Students will appear here once they're enrolled in one of your courses."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No students match your filters" />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((student) => (
            <Card
              key={student.id}
              padding="sm"
              className="flex cursor-pointer items-center justify-between gap-3 transition-colors hover:bg-surface-hover"
              onClick={() => navigate(`/teacher/students/${student.id}`)}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={student.name} src={student.avatarUrl} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{student.name}</p>
                  <p className="truncate text-xs text-muted">{student.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                {student.programName ? <Badge variant="primary">{student.programName}</Badge> : null}
                {student.className ? (
                  <Badge variant="neutral">
                    {student.className}
                    {student.sectionName ? ` — ${student.sectionName}` : ''}
                  </Badge>
                ) : null}
                <Badge variant="neutral">
                  {student.courses.length} course{student.courses.length === 1 ? '' : 's'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
};
