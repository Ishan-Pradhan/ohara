/** One reference to a record that blocks its deletion. Produced by
 * `deleteBlockers.repository.ts` for each RESTRICT-guarded FK on an entity,
 * and surfaced to the admin as a structured 409 `errors` payload plus a
 * human-readable message explaining what to remove first. */
export interface DeleteBlocker {
  /** Stable machine id, e.g. `'section'`. */
  entity: string;
  /** Plural human label, e.g. `'sections'`. */
  label: string;
  /** Singular human label, e.g. `'section'`. */
  singular: string;
  count: number;
  /** What to do before this record can be deleted. */
  hint: string;
  /** Whether this blocker is an immutable academic record (`'academic_record'`)
   * or an owned artifact that can be deleted/reassigned (`'ownership'`).
   * Academic-record blockers mean hard deletion is simply not available —
   * the admin should archive instead. Ownership blockers must be cleared
   * before the entity can be permanently removed. */
  category: 'academic_record' | 'ownership';
}
