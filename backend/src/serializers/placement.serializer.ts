import type { ClassMembership } from '../models/classMemberships.model.js';

export const serializeClassMembership = (m: ClassMembership) => ({
  id: m.id,
  studentId: m.studentId,
  sectionId: m.sectionId,
  academicYearId: m.academicYearId,
  outcome: m.outcome,
  promotedToId: m.promotedToId,
  createdAt: m.createdAt,
});
