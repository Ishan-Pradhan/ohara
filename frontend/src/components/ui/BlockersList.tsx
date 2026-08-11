import type { DeleteBlocker } from '../../lib/apiError.js';
import { Alert } from './Alert.js';

/** Renders the structured 409 blocker breakdown returned by the backend when a
 * delete is refused — tells an admin exactly what references the record and
 * what to do first.
 *
 * Blockers are split into two categories:
 * - `academic_record`: permanent transcript evidence that cannot be removed.
 *   Hard deletion is simply not available for this entity — use archive instead.
 * - `ownership`: artifacts the entity owns that can be deleted or reassigned
 *   before the entity can be permanently removed. */
export const BlockersList = ({ blockers }: { blockers: DeleteBlocker[] }) => {
  if (blockers.length === 0) return null;

  const academic = blockers.filter((b) => b.category === 'academic_record');
  const ownership = blockers.filter((b) => b.category === 'ownership');

  return (
    <div className="mt-3 space-y-2">
      {academic.length > 0 ? (
        <Alert variant="warning">
          <p className="font-medium">Hard deletion is not available — permanent academic records exist:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            {academic.map((blocker) => (
              <li key={blocker.entity}>
                {blocker.count} {blocker.count === 1 ? blocker.singular : blocker.label}
                <span className="text-muted"> — {blocker.hint}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            Use <strong>Archive</strong> to revoke access while preserving the academic record.
          </p>
        </Alert>
      ) : null}

      {ownership.length > 0 ? (
        <Alert variant="danger">
          <p className="font-medium">Owned artifacts that must be removed first:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            {ownership.map((blocker) => (
              <li key={blocker.entity}>
                {blocker.count} {blocker.count === 1 ? blocker.singular : blocker.label}
                <span className="text-muted"> — {blocker.hint}</span>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
    </div>
  );
};