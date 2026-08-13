import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Flag, NotebookPen, Trash2 } from 'lucide-react';

import {
  useMyStudent,
  useMyStudentNotes,
  useCreateMyStudentNote,
  useDeleteMyStudentNote,
} from '../../features/teacher/useTeacher.js';
import { pctColor } from '../../lib/pctColor.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Badge } from '../../components/ui/Badge.js';
import { Button } from '../../components/ui/Button.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';
import { ConfirmDialog } from '../../components/ui/Dialog.js';
import { StudentInfoCard } from '../admin/StudentInfoCard.js';
import { FlagStudentDialog } from './FlagStudentDialog.js';

const flagStatusVariant = { open: 'warning', resolved: 'success' } as const;

export const MyStudentDetailPage = () => {
  const { studentId = '' } = useParams();
  const { data: student, isLoading } = useMyStudent(studentId);
  const { data: notes, isLoading: notesLoading } = useMyStudentNotes(studentId);
  const createNote = useCreateMyStudentNote(studentId);
  const deleteNote = useDeleteMyStudentNote(studentId);

  const [flagOpen, setFlagOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const onAddNote = async () => {
    if (!noteDraft.trim()) return;
    await createNote.mutateAsync(noteDraft.trim());
    setNoteDraft('');
    toast.success('Note added');
  };

  const onConfirmDeleteNote = async () => {
    if (!deletingNoteId) return;
    await deleteNote.mutateAsync(deletingNoteId);
    toast.success('Note deleted');
    setDeletingNoteId(null);
  };

  if (isLoading || !student) {
    return (
      <AppShell>
        <Skeleton className="h-10 w-64" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link to="/teacher/students" className="mb-1 flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ChevronLeft className="size-3.5" aria-hidden />
        My Students
      </Link>

      <PageHeader
        title="Student profile"
        actions={
          <Button size="sm" variant="secondary" onClick={() => setFlagOpen(true)}>
            <Flag className="size-4" aria-hidden />
            Flag for admin
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3">
        <StudentInfoCard
          student={student}
          profile={{
            dateOfBirth: student.dateOfBirth,
            studentPhone: student.studentPhone,
            address: student.address,
            parentName: student.parentName,
            parentPhone: student.parentPhone,
            previousSchool: student.previousSchool,
          }}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {student.programName ? <Badge variant="primary">{student.programName}</Badge> : null}
          {student.className ? (
            <Badge variant="neutral">
              {student.className}
              {student.sectionName ? ` — ${student.sectionName}` : ''}
            </Badge>
          ) : null}
          {student.batchName ? <Badge variant="neutral">Batch {student.batchName}</Badge> : null}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
            Courses with you
          </h2>
          <div className="flex flex-col gap-2">
            {student.courses.map((course) => (
              <Card key={course.courseId} padding="sm" className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{course.courseTitle}</p>
                  <p className="truncate text-xs text-muted">{course.courseCode}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-subtle">Grade average</p>
                    <p className={`text-sm font-semibold ${pctColor(course.grade?.average ?? null)}`}>
                      {course.grade?.average === null || course.grade?.average === undefined
                        ? '—'
                        : `${course.grade.average.toFixed(0)}%`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-subtle">Attendance</p>
                    <p className={`text-sm font-semibold ${pctColor(course.attendance.percentage)}`}>
                      {course.attendance.percentage === null
                        ? '—'
                        : `${course.attendance.percentage.toFixed(0)}%`}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Flags</h2>
          {student.flags.length === 0 ? (
            <p className="text-sm text-muted">No flags raised for this student.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {student.flags.map((f) => (
                <Card key={f.id} padding="sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-fg">{f.reason}</p>
                    <Badge variant={flagStatusVariant[f.status]}>{f.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    Raised by {f.raisedByName ?? 'Unknown'} · {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
            <NotebookPen className="size-3.5" aria-hidden />
            Your private notes
          </h2>
          <p className="mb-3 text-xs text-muted">Only visible to you — not shared with other teachers, admins, or the student.</p>

          <div className="mb-4 flex flex-col gap-2">
            <Textarea
              rows={2}
              placeholder="Add a note about this student…"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                loading={createNote.isPending}
                disabled={!noteDraft.trim()}
                onClick={onAddNote}
              >
                Add note
              </Button>
            </div>
            {createNote.error instanceof ApiError ? (
              <p className="text-xs text-danger">{createNote.error.message}</p>
            ) : null}
          </div>

          {notesLoading ? (
            <Skeleton className="h-14 w-full" />
          ) : !notes || notes.length === 0 ? (
            <EmptyState icon={NotebookPen} title="No notes yet" />
          ) : (
            <div className="flex flex-col gap-2">
              {notes.map((note) => (
                <Card key={note.id} padding="sm" className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap text-sm text-fg">{note.content}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {new Date(note.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Delete note"
                    onClick={() => setDeletingNoteId(note.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <FlagStudentDialog
        studentId={student.id}
        studentName={student.name}
        courseId={student.courses[0]?.courseId}
        open={flagOpen}
        onOpenChange={setFlagOpen}
      />

      <ConfirmDialog
        open={deletingNoteId !== null}
        onOpenChange={(open) => !open && setDeletingNoteId(null)}
        title="Delete this note?"
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        loading={deleteNote.isPending}
        onConfirm={onConfirmDeleteNote}
      />
    </AppShell>
  );
};
