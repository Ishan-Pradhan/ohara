import { courseRepository } from '../repositories/courses.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { deriveClassTerm } from '../utils/academicTerm.utils.js';
import type { AcademicYear } from '../models/academicYears.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * A Course is permanently attached to its Class (e.g. "Physics" under
 * "Semester 3") and reused by every future batch that reaches that class —
 * unlike a Section, it has no per-year row of its own. Assignments, quizzes,
 * grade trends, gradebook, and several other course-scoped readers need to
 * know "which batch's live offering is this."
 *
 * **Rewritten 2026-08-12** — the original "majority vote across active
 * `enrollments`" approach (a few retained students who landed in the same
 * class under a newer year shouldn't outvote the bulk cohort) assumed an
 * old cohort's `enrollments` rows stop counting once they've moved on. They
 * don't: nothing ever closes out an `enrollments` row when a student is
 * promoted or graduates, so a small, genuinely-current cohort (a fresh
 * semester that just started, a handful of students) was routinely outvoted
 * by a much larger *former* cohort whose enrollment rows simply never went
 * away — reported directly by the user seeing old semesters' grade trends
 * for a course whose current section had only 2–3 students against 18 in
 * each of two stale prior years.
 *
 * Now a three-tier fallback, each stage only reached if the one above found
 * nothing:
 *   1. Same shape as `resolveRelevantAttendanceYear` (attendance.controller.ts):
 *      derive "who's really here now" from `class_memberships`, which
 *      promotion actually keeps accurate, intersected with who's ever
 *      enrolled in this course, per candidate year (a year needs sections
 *      to be a candidate at all). This is the fix — it ignores a stale
 *      `enrollments` row the moment the student's *current* placement has
 *      moved to a different year's section.
 *   2. The original raw majority-vote-by-`enrollments.academicYearId`,
 *      unchanged — the only signal available when the class has no sections
 *      recorded at all yet (a brand-new class, or enrollment created ahead
 *      of section assignment), so there's nothing for tier 1 to derive
 *      placement from.
 *   3. Whichever year is globally marked current for this term — unsafe
 *      alone once more than one program shares a term, since a program
 *      running behind schedule can still have real students under last
 *      term's year even after an admin marks the *next* one current for a
 *      different, faster program, so this is the last resort, not the
 *      default.
 */
export const resolveCurrentAcademicYearForCourse = async (
  courseId: string,
): Promise<AcademicYear> => {
  const course = await courseRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const cls = await classRepository.findByIdWithProgram(course.classId);
  if (!cls || !cls.program) {
    throw new ApiError(500, 'Course references a missing class or program');
  }
  const term = deriveClassTerm(cls.program.institutionType, cls.orderIndex);

  const [allClassSections, activeEnrollments] = await Promise.all([
    sectionRepository.findAll({ classId: course.classId }),
    enrollmentRepository.findByCourseWithStudents(courseId),
  ]);
  const enrolledStudentIds = new Set(activeEnrollments.map((e) => e.studentId));

  // Tier 1: current placement, derived from class_memberships.
  if (allClassSections.length > 0 && enrolledStudentIds.size > 0) {
    const yearIds = [...new Set(allClassSections.map((s) => s.academicYearId))];
    const currentTermYear = (await academicYearRepository.findAll()).find(
      (y) => y.isCurrent && y.term === term,
    );

    const countByYear = new Map<string, number>();
    for (const yearId of yearIds) {
      const sectionsInYear = allClassSections.filter((s) => s.academicYearId === yearId);
      const memberLists = await Promise.all(
        sectionsInYear.map((s) => classMembershipRepository.findBySectionWithStudents(s.id)),
      );
      const placedIds = new Set(memberLists.flat().map((m) => m.studentId));
      let count = 0;
      for (const studentId of placedIds) {
        if (enrolledStudentIds.has(studentId)) count++;
      }
      countByYear.set(yearId, count);
    }

    let targetYearId: string | undefined;
    if (currentTermYear && (countByYear.get(currentTermYear.id) ?? 0) > 0) {
      targetYearId = currentTermYear.id;
    } else {
      targetYearId = yearIds
        .filter((id) => (countByYear.get(id) ?? 0) > 0)
        .sort((a, b) => (countByYear.get(b) ?? 0) - (countByYear.get(a) ?? 0))[0];
    }

    if (targetYearId) {
      const academicYear = await academicYearRepository.findById(targetYearId);
      if (academicYear) {
        return academicYear;
      }
    }
  }

  // Tier 2: no sections recorded for this class yet — fall back to the raw
  // enrollment-year majority vote, the only signal available.
  if (activeEnrollments.length > 0) {
    const counts = new Map<string, number>();
    for (const enrollment of activeEnrollments) {
      counts.set(enrollment.academicYearId, (counts.get(enrollment.academicYearId) ?? 0) + 1);
    }
    let majorityYearId: string | null = null;
    let majorityCount = 0;
    for (const [yearId, count] of counts) {
      if (count > majorityCount) {
        majorityYearId = yearId;
        majorityCount = count;
      }
    }
    const academicYear = majorityYearId ? await academicYearRepository.findById(majorityYearId) : null;
    if (academicYear) {
      return academicYear;
    }
  }

  // Tier 3: last resort.
  const academicYear = await academicYearRepository.findCurrentByTerm(term);
  if (!academicYear) {
    throw new ApiError(
      400,
      `No academic year is currently marked current for the '${term}' term — ` +
        'an admin needs to create (or mark current) the academic year for this ' +
        'course before assignments or quizzes can be created here.',
    );
  }

  return academicYear;
};
