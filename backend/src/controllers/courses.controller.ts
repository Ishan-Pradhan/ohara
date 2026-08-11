import { courseRepository } from '../repositories/courses.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { deriveClassTerm } from '../utils/academicTerm.utils.js';
import type { AcademicYear } from '../models/academicYears.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * A Course is permanently attached to its Class (e.g. "Physics" under
 * "Semester 3") and reused by every future batch that reaches that class —
 * unlike a Section, it has no per-year row of its own. Assignments and
 * quizzes need to know "which batch's live offering is this."
 *
 * Prefers the academic year the course's own currently-enrolled students are
 * actually in (majority vote across active enrollments — a few retained
 * students who landed in the same class under a newer year shouldn't
 * outvote the bulk cohort), and only falls back to "whichever year is
 * globally marked current for this term" when nobody is enrolled yet (a
 * brand-new course). The fallback alone isn't safe once more than one
 * program shares a term: different programs' semesters don't necessarily
 * end on the same calendar date, so a program running behind schedule can
 * still have active students under last term's academic year even after an
 * admin has marked the *next* one current for a different, faster program —
 * the global flag would silently resolve new assignments/quizzes to the
 * wrong year for the lagging program's course.
 */
export const resolveCurrentAcademicYearForCourse = async (
  courseId: string,
): Promise<AcademicYear> => {
  const course = await courseRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const activeEnrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
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

  const cls = await classRepository.findByIdWithProgram(course.classId);
  if (!cls || !cls.program) {
    throw new ApiError(500, 'Course references a missing class or program');
  }

  const term = deriveClassTerm(cls.program.institutionType, cls.orderIndex);
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
