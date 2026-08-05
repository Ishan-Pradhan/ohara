import type { ClassMembership } from '../models/classMemberships.model.js';
import type { Enrollment } from '../models/enrollments.model.js';

export const serializeClassMembership = (m: ClassMembership) => ({
  id: m.id,
  studentId: m.studentId,
  batchId: m.batchId,
  sectionId: m.sectionId,
  academicYearId: m.academicYearId,
  outcome: m.outcome,
  promotedToId: m.promotedToId,
  createdAt: m.createdAt,
});

export const serializeEnrollment = (e: Enrollment) => ({
  id: e.id,
  studentId: e.studentId,
  courseId: e.courseId,
  academicYearId: e.academicYearId,
  status: e.status,
  createdAt: e.createdAt,
});
