import type { InstitutionType } from '../types/institution.types.js';
import type { AcademicYearTerm } from '../types/institution.types.js';

/** Odd/even semesters (1/3/5/7 vs 2/4/6/8) run on offset calendars for
 * college/university programs in Nepal — schools don't split into odd/even
 * at all (one class per year), so they're always 'annual'. Derived from
 * orderIndex parity rather than stored on Class, since it's fully
 * determined by (institutionType, orderIndex) and doesn't need its own
 * column. Mirrors frontend/src/lib/academicTerm.ts — keep both in sync. */
export const deriveClassTerm = (institutionType: InstitutionType, orderIndex: number): AcademicYearTerm => {
  if (institutionType === 'school') return 'annual';
  return orderIndex % 2 === 1 ? 'odd' : 'even';
};
