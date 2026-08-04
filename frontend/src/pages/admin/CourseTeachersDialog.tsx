import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';

import {
  assignCourseTeacherSchema,
  type AssignCourseTeacherInput,
} from '../../features/institution/institution.schema.js';
import {
  useAssignCourseTeacher,
  useCourseTeachers,
} from '../../features/institution/useInstitution.js';
import { useTeachers } from '../../features/users/useUsers.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { Dialog } from '../../components/ui/Dialog.js';
import { Avatar } from '../../components/ui/Avatar.js';
import { Select } from '../../components/ui/Select.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

interface CourseTeachersDialogProps {
  courseId: string;
  courseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CourseTeachersDialog = ({
  courseId,
  courseTitle,
  open,
  onOpenChange,
}: CourseTeachersDialogProps) => {
  const { data: assigned, isLoading } = useCourseTeachers(courseId);
  const { data: teachers } = useTeachers();
  const { mutateAsync, isPending, error, reset } = useAssignCourseTeacher(courseId);

  const {
    control,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<AssignCourseTeacherInput>({ resolver: zodResolver(assignCourseTeacherSchema) });

  const assignedIds = new Set((assigned ?? []).map((a) => a.teacherId));
  const availableOptions = (teachers ?? [])
    .filter((t) => !assignedIds.has(t.id))
    .map((t) => ({ value: t.id, label: t.name }));

  const onSubmit = handleSubmit(async (values) => {
    const created = await mutateAsync(values);
    toast.success(`${created.teacherName} assigned to ${courseTitle}`);
    resetForm();
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          resetForm();
          reset();
        }
      }}
      title={`Teachers — ${courseTitle}`}
      description="Teachers assigned here can access this course's material once teaching tools ship."
    >
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !assigned || assigned.length === 0 ? (
          <EmptyState icon={UserPlus} title="No teachers assigned yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {assigned.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-control border border-border px-3 py-2">
                <Avatar name={a.teacherName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{a.teacherName}</p>
                  <p className="truncate text-xs text-muted">{a.teacherEmail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {teachers && teachers.length === 0 ? (
          <Alert variant="info">No teacher accounts exist yet.</Alert>
        ) : (
          <form onSubmit={onSubmit} className="flex items-end gap-2" noValidate>
            {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}
            <div className="flex-1">
              <Controller
                control={control}
                name="teacherId"
                render={({ field: selectField }) => (
                  <Select
                    options={availableOptions}
                    value={selectField.value}
                    onValueChange={selectField.onChange}
                    invalid={Boolean(errors.teacherId)}
                    placeholder={
                      availableOptions.length ? 'Select a teacher' : 'All teachers already assigned'
                    }
                  />
                )}
              />
            </div>
            <Button type="submit" loading={isPending} disabled={!availableOptions.length}>
              Assign
            </Button>
          </form>
        )}
      </div>
    </Dialog>
  );
};
