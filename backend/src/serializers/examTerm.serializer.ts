import type { ExamTerm } from '../models/examTerms.model.js';

export const serializeExamTerm = (term: ExamTerm) => ({
  id: term.id,
  name: term.name,
  academicYearId: term.academicYearId,
  createdAt: term.createdAt,
});
