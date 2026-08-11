import { courseRepository } from '../repositories/courses.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { deriveClassTerm } from '../utils/academicTerm.utils.js';
import type { AcademicYear } from '../models/academicYears.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * A Course is permanently attached to its Class (e.g. "Physics" under
 * "Semester 3") and reused by every future batch that reaches that class —
 * unlike a Section, it has no per-year row of its own. Assignments and
 * quizzes need to know "which batch's live offering is this," so this
 * derives it the same way a Section's own term requirement is derived
 * (course -> class -> institutionType/orderIndex -> term), then looks up
 * whichever academic year is currently marked current for that term.
 * Shared by assignments/quizzes controllers (creation + listing) and every
 * aggregation built on top of them (gradebook, at-risk, trends, copilot,
 * weekly intelligence) — see docs/ROADMAP.md's Phase 8 note on cross-batch
 * assignment/quiz scoping.
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
