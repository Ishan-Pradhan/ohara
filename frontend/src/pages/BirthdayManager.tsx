import { useState } from 'react';
import { Cake } from 'lucide-react';

import { useUsers } from '../features/users/useUsers.js';
import { useSetDateOfBirth } from '../features/events/useEvents.js';
import { toast } from '../lib/toast.js';
import { Card } from '../components/ui/Card.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';

export const BirthdayManager = () => {
  const [search, setSearch] = useState('');
  const [dobDrafts, setDobDrafts] = useState<Record<string, string>>({});
  const { data } = useUsers({ search, limit: 5 });
  const setDob = useSetDateOfBirth();

  const onSave = async (userId: string) => {
    const value = dobDrafts[userId];
    if (!value) return;
    try {
      await setDob.mutateAsync({ userId, dateOfBirth: value });
      toast.success('Birthday saved');
    } catch {
      toast.error('Could not save the birthday');
    }
  };

  return (
    <Card padding="sm" className="mb-4">
      <div className="mb-2 flex items-center gap-2 px-1">
        <Cake className="size-4 text-accent-fg" aria-hidden />
        <h2 className="text-sm font-semibold text-fg">Set a birthday</h2>
      </div>
      <Input
        placeholder="Search a student, teacher, or admin by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {search && data?.items.length ? (
        <div className="mt-2 flex flex-col divide-y divide-border">
          {data.items.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-fg">{u.name}</span>
                <Badge variant="neutral">{u.role}</Badge>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Input
                  type="date"
                  value={dobDrafts[u.id] ?? ''}
                  onChange={(e) => setDobDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                />
                <Button size="sm" variant="secondary" onClick={() => onSave(u.id)} loading={setDob.isPending}>
                  Save
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
};
