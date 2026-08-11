/** Text color for a percentage value, matching the ≥80 success / ≥threshold
 * accent / below danger convention used across gradebook, attendance, and
 * at-risk views. */
export const pctColor = (value: number | null, threshold = 60): string => {
  if (value === null) return 'text-muted';
  if (value >= 80) return 'text-success';
  if (value >= threshold) return 'text-accent-fg';
  return 'text-danger';
};
