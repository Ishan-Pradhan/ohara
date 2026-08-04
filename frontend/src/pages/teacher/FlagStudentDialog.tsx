import { useState } from 'react';

import { useCreateFlag } from '../../features/teacher/useTeacher.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { Dialog } from '../../components/ui/Dialog.js';
import { Button } from '../../components/ui/Button.js';
import { Field } from '../../components/ui/Field.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { Alert } from '../../components/ui/Alert.js';

interface FlagStudentDialogProps {
  studentId: string;
  studentName: string;
  courseId?: string;
  sectionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FlagStudentDialog = ({
  studentId,
  studentName,
  courseId,
  sectionId,
  open,
  onOpenChange,
}: FlagStudentDialogProps) => {
  const [reason, setReason] = useState('');
  const createFlag = useCreateFlag();

  const close = () => {
    onOpenChange(false);
    setReason('');
    createFlag.reset();
  };

  const onSubmit = async () => {
    await createFlag.mutateAsync({ studentId, reason, courseId, sectionId });
    toast.success(`Flagged ${studentName} for admin attention`);
    close();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={`Flag ${studentName}`}
      description="A short note for admins — not visible to the student, and doesn't change anything about their record."
    >
      <div className="flex flex-col gap-4">
        {createFlag.error instanceof ApiError ? <Alert>{createFlag.error.message}</Alert> : null}
        <Field label="Reason" htmlFor="flag-reason">
          <Textarea
            id="flag-reason"
            rows={4}
            placeholder="e.g. Missed the last two classes, hasn't responded to messages."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="button" loading={createFlag.isPending} disabled={!reason.trim()} onClick={onSubmit}>
            Flag for admin
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
