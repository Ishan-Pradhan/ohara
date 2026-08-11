import { useState } from 'react';
import { Cake, Send, Check } from 'lucide-react';

import { useTodayBirthdays, useSendBirthdayWish } from '../../features/birthdays/useBirthdays.js';
import type { BirthdayPerson } from '../../features/birthdays/birthdays.schema.js';
import { Card } from '../ui/Card.js';
import { Badge } from '../ui/Badge.js';
import { Button } from '../ui/Button.js';
import { Spinner } from '../ui/Spinner.js';
import { toast } from '../../lib/toast.js';

function PersonCard({ person }: { person: BirthdayPerson }) {
  const sendWish = useSendBirthdayWish();
  const [wished, setWished] = useState(person.wishedToday);

  const handleSend = async () => {
    try {
      await sendWish.mutateAsync({
        studentIds: [person.id],
        message: `Happy Birthday, ${person.name}! Wishing you a wonderful day and an amazing year ahead.`,
      });
      setWished(true);
      toast.success(`Birthday wish sent to ${person.name}`);
    } catch {
      toast.error(`Failed to send wish to ${person.name}`);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft">
          {person.avatarUrl ? (
            <img src={person.avatarUrl} alt="" className="size-9 rounded-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-accent-fg">
              {person.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg truncate">{person.name}</p>
          <p className="text-xs text-muted capitalize">{person.role}</p>
        </div>
      </div>
      <div className="shrink-0">
        {person.role === 'student' ? (
          wished ? (
            <Badge variant="success" className="gap-1">
              <Check className="size-3" /> Wished
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSend}
              loading={sendWish.isPending}
            >
              <Send className="size-3" /> Send wish
            </Button>
          )
        ) : (
          <Badge variant="neutral">Non-student</Badge>
        )}
      </div>
    </div>
  );
}

export function BirthdayWidget() {
  const { data: birthdays, isLoading, error } = useTodayBirthdays();
  const sendWish = useSendBirthdayWish();
  const [batchMessage, setBatchMessage] = useState('');

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Cake className="size-4 text-accent-fg" aria-hidden />
          <h2 className="text-sm font-semibold">Today's Birthdays</h2>
        </div>
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Cake className="size-4 text-accent-fg" aria-hidden />
          <h2 className="text-sm font-semibold">Today's Birthdays</h2>
        </div>
        <p className="text-sm text-muted">Could not load birthdays.</p>
      </Card>
    );
  }

  const people = birthdays ?? [];
  const unwishedStudents = people.filter(
    (p) => p.role === 'student' && !p.wishedToday,
  );

  const handleWishAll = async () => {
    if (unwishedStudents.length === 0) return;
    const msg =
      batchMessage ||
      'Happy Birthday! Wishing you a wonderful day and an amazing year ahead.';
    try {
      const result = await sendWish.mutateAsync({
        studentIds: unwishedStudents.map((p) => p.id),
        message: msg,
      });
      toast.success(`Wishes sent: ${result.sent} success, ${result.failed} failed`);
      setBatchMessage('');
    } catch {
      toast.error('Failed to send birthday wishes');
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cake className="size-4 text-accent-fg" aria-hidden />
          <h2 className="text-sm font-semibold">Today's Birthdays</h2>
        </div>
        {unwishedStudents.length > 0 && (
          <Button
            size="sm"
            variant="primary"
            onClick={handleWishAll}
            loading={sendWish.isPending}
          >
            <Send className="size-3" /> Wish all ({unwishedStudents.length})
          </Button>
        )}
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-muted py-2">No birthdays today.</p>
      ) : (
        <div className="divide-y divide-border">
          {people.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </Card>
  );
}
