import { useState } from 'react';
import { Mail } from 'lucide-react';

import { useInviteUsersBatch } from '../../features/users/useUsers.js';
import type { BatchInviteResult } from '../../features/users/users.schema.js';
import { ApiError } from '../../lib/apiError.js';
import { Dialog } from '../../components/ui/Dialog.js';
import { Button } from '../../components/ui/Button.js';
import { Field } from '../../components/ui/Field.js';
import { Textarea } from '../../components/ui/Textarea.js';
import { Alert } from '../../components/ui/Alert.js';
import { Badge } from '../../components/ui/Badge.js';

interface InviteStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  line: string;
  name: string;
  email: string;
  valid: boolean;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const parseRows = (raw: string): ParsedRow[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(/[,\t]/)
        .map((p) => p.trim())
        .filter(Boolean);

      const [name, email] =
        parts.length >= 2
          ? [parts[0], parts[1]]
          : [titleCase((parts[0] ?? '').split('@')[0] ?? ''), parts[0] ?? ''];

      return { line, name, email, valid: EMAIL_PATTERN.test(email) };
    });

export const InviteStudentsDialog = ({ open, onOpenChange }: InviteStudentsDialogProps) => {
  const [raw, setRaw] = useState('');
  const [result, setResult] = useState<BatchInviteResult | null>(null);
  const { mutateAsync, isPending, error, reset } = useInviteUsersBatch();

  const rows = parseRows(raw);
  const invalidRows = rows.filter((r) => !r.valid);
  const canSubmit = rows.length > 0 && invalidRows.length === 0;

  const close = () => {
    onOpenChange(false);
    setRaw('');
    setResult(null);
    reset();
  };

  const onSubmit = async () => {
    const res = await mutateAsync({
      role: 'student',
      users: rows.map(({ name, email }) => ({ name, email })),
    });
    setResult(res);
    if (res.skipped.length === 0) {
      close();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Invite students"
      description="One per line: Name, Email — paste straight from a spreadsheet. Each student gets an email to set their own password; nobody sees it but them."
    >
      <div className="flex flex-col gap-4">
        {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

        {result ? (
          <div className="flex flex-col gap-3">
            <Alert variant="success" icon={Mail}>
              Invited {result.invited.length} student{result.invited.length === 1 ? '' : 's'}.
            </Alert>
            {result.skipped.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-fg">
                  Skipped {result.skipped.length}:
                </p>
                <ul className="flex flex-col gap-1.5">
                  {result.skipped.map((row) => (
                    <li
                      key={row.email}
                      className="flex items-center justify-between rounded-control border border-border px-3 py-2 text-sm"
                    >
                      <span className="text-fg">{row.email}</span>
                      <Badge variant="warning">{row.reason}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-2 flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <Field
              label="Students"
              htmlFor="invite-students"
              hint={
                rows.length > 0
                  ? `${rows.length} row${rows.length === 1 ? '' : 's'}${
                      invalidRows.length ? ` — ${invalidRows.length} need a valid email` : ''
                    }`
                  : 'Up to 200 at a time'
              }
              error={
                invalidRows.length > 0
                  ? `Fix these lines: ${invalidRows.map((r) => `"${r.line}"`).join(', ')}`
                  : undefined
              }
            >
              <Textarea
                id="invite-students"
                rows={8}
                placeholder={'Priya Sharma, priya@example.com\nRam Thapa, ram@example.com'}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                invalid={invalidRows.length > 0}
              />
            </Field>

            <div className="mt-2 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                loading={isPending}
                disabled={!canSubmit}
                onClick={onSubmit}
              >
                <Mail className="size-4" aria-hidden />
                Send invites
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
};
