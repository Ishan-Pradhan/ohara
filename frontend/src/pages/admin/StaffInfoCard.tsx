import { Avatar } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';

interface StaffInfoCardProps {
  user: {
    name: string;
    email: string;
    avatarUrl: string | null;
    role: 'admin' | 'teacher';
    isVerified: boolean;
    isBlocked: boolean;
    createdAt: string;
  };
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-subtle">{label}</p>
    <p className="text-sm font-medium text-fg">{value}</p>
  </div>
);

/** Shared between the admin-facing Staff detail page and a teacher's own
 * "My Profile" page — same shape StudentInfoCard.tsx uses for students. */
export const StaffInfoCard = ({ user }: StaffInfoCardProps) => {
  const joined = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} src={user.avatarUrl} size="lg" />
          <div>
            <p className="text-base font-semibold text-fg">{user.name}</p>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={user.role === 'admin' ? 'primary' : 'accent'}>
            {user.role === 'admin' ? 'Admin' : 'Teacher'}
          </Badge>
          {user.isBlocked ? (
            <Badge variant="danger">Blocked</Badge>
          ) : user.isVerified ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge>Invite pending</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
        <Field label="Joined" value={joined} />
      </div>
    </Card>
  );
};
