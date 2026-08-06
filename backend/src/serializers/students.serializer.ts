import type { ClassMembership } from '../models/classMemberships.model.js';
import type { Enrollment } from '../models/enrollments.model.js';

export const serializeStudentPlacement = (
  membership: ClassMembership,
  enrollments: Enrollment[],
) => ({
  studentId: membership.studentId,
  // section/class/program are FK-enforced NOT NULL and always requested via the repository's
  // include — undefined here would mean the DB is in an inconsistent state, not a normal case.
  program: membership.section?.class?.program
    ? {
        id: membership.section.class.program.id,
        name: membership.section.class.program.name,
        institutionType: membership.section.class.program.institutionType,
        affiliation: membership.section.class.program.affiliation,
      }
    : null,
  class: membership.section?.class
    ? { id: membership.section.class.id, name: membership.section.class.name }
    : null,
  section: membership.section
    ? { id: membership.section.id, name: membership.section.name }
    : null,
  academicYear: membership.academicYear
    ? { id: membership.academicYear.id, name: membership.academicYear.name }
    : null,
  batch: membership.batch ? { id: membership.batch.id, name: membership.batch.name } : null,
  courses: enrollments.map((enrollment) => ({
    id: enrollment.course?.id,
    title: enrollment.course?.title,
    code: enrollment.course?.code,
    isPublished: enrollment.course?.isPublished ?? false,
    teachers: (enrollment.course?.teachers ?? []).map((teacher) => ({
      id: teacher.id,
      name: teacher.name,
    })),
  })),
});
