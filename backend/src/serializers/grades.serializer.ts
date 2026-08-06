import type { Grade } from '../models/grades.model.js';

// Postgres NUMERIC/DECIMAL columns round-trip as strings through the pg
// driver (precision safety) — coerce to a real number for the API contract.
export const serializeGrade = (g: Grade) => ({
  id: g.id,
  submissionId: g.submissionId,
  score: Number(g.score),
  criterionFeedback: g.criterionFeedback,
  overallFeedback: g.overallFeedback,
  status: g.status,
  approvedBy: g.approvedBy,
  createdAt: g.createdAt,
});
