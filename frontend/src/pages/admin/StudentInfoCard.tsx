import { Avatar } from '../../components/ui/Avatar.js';
import { Badge } from '../../components/ui/Badge.js';
import { Card } from '../../components/ui/Card.js';

interface StudentInfoCardProps {
  student: {
    name: string;
    email: string;
    avatarUrl: string | null;
    status: 'active' | 'inactive' | 'graduated' | 'archived';
  };
  /** All from StudentProfile — populated lazily by the admission form (or
   * the student's own self-service edit), so any/all of these are commonly
   * null rather than missing data being a bug. */
  profile: {
    dateOfBirth: string | null;
    studentPhone: string | null;
    address: string | null;
    parentName: string | null;
    parentPhone: string | null;
    previousSchool: string | null;
  };
}

const statusVariant = {
  active: 'success',
  inactive: 'neutral',
  graduated: 'accent',
  archived: 'neutral',
} as const;

const Field = ({ label, value }: { label: string; value: string | null }) => (
  <div>
    <p className="text-xs text-subtle">{label}</p>
    <p className="text-sm font-medium text-fg">{value ?? <span className="font-normal text-muted">Not provided</span>}</p>
  </div>
);

export const StudentInfoCard = ({ student, profile }: StudentInfoCardProps) => {
  const dob = profile.dateOfBirth
    ? new Date(profile.dateOfBirth).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={student.name} src={student.avatarUrl} size="lg" />
          <div>
            <p className="text-base font-semibold text-fg">{student.name}</p>
            <p className="text-sm text-muted">{student.email}</p>
          </div>
        </div>
        <Badge variant={statusVariant[student.status]}>{student.status}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
        <Field label="Date of birth" value={dob} />
        <Field label="Student phone" value={profile.studentPhone} />
        <Field label="Address" value={profile.address} />
        <Field label="Parent / guardian" value={profile.parentName} />
        <Field label="Parent / guardian phone" value={profile.parentPhone} />
        <Field label="Previous school" value={profile.previousSchool} />
      </div>
    </Card>
  );
};
