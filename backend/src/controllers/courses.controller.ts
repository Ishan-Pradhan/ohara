import { courseRepository } from '../repositories/courses.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { batchRepository } from '../repositories/batches.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import type { Batch } from '../models/batches.model.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * A Course is permanently attached to its Class (e.g. "Physics" under
 * "Semester 3") and reused by every future batch that reaches that class —
 * unlike a Section, it has no per-batch row of its own. Assignments, quizzes,
 * grade trends, gradebook, and several other course-scoped readers need to
 * know "which batch's live offering is this."
 *
 * **Rewritten 2026-08-13** for the batch-permanent placement model — a
 * batch's `class_memberships.outcome = 'enrolled'` rows now ARE its current
 * placement, directly and structurally, so "who's really here now" no
 * longer needs the old three-tier academic-year-matching fallback
 * (majority-vote-by-enrollment-year, then whichever year is globally
 * `is_current`). Two tiers, both structural, neither guesses at a calendar:
 *   1. which batch currently has `outcome: 'enrolled'` members in this
 *      class, most populated first — the normal case. Usually resolves to
 *      exactly one batch; more than one only if this class currently holds
 *      students from more than one batch (promotion applied non-uniformly).
 *   2. a student can be enrolled in a course without a formal section
 *      placement (electives added ad hoc, or a course used before any
 *      section exists yet) — when tier 1 finds nothing, fall back to
 *      majority vote across the course's own active enrollments' batchId.
 */
/** Read/reporting call sites (gradebook, grade trends, class intelligence,
 * teacher copilot, weekly intelligence) want `null` for "nothing here yet"
 * — an empty course is a normal, common state to report on, not an error.
 * Write call sites (creating an assignment/quiz) need a real batch to scope
 * the new row to, so they go through the throwing wrapper below instead. */
export const resolveCurrentBatchForCourseOrNull = async (courseId: string): Promise<Batch | null> => {
  const course = await courseRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const candidates = await classMembershipRepository.countEnrolledByClassGroupedByBatch(
    course.classId,
  );
  if (candidates.length > 0) {
    // Already sorted most-populated-first by the repository.
    const batch = await batchRepository.findById(candidates[0]!.batchId);
    if (batch) return batch;
  }

  const enrollments = await enrollmentRepository.findByCourseWithStudents(courseId);
  const countByBatchId = new Map<string, number>();
  for (const enrollment of enrollments) {
    countByBatchId.set(enrollment.batchId, (countByBatchId.get(enrollment.batchId) ?? 0) + 1);
  }
  const topBatchId = [...countByBatchId.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topBatchId) {
    const batch = await batchRepository.findById(topBatchId);
    if (batch) return batch;
  }

  return null;
};

export const resolveCurrentBatchForCourse = async (courseId: string): Promise<Batch> => {
  const batch = await resolveCurrentBatchForCourseOrNull(courseId);
  if (!batch) {
    throw new ApiError(
      400,
      "No students are currently placed or enrolled in this course's class — place or enroll " +
        'students before creating assignments or quizzes here.',
    );
  }
  return batch;
};

/** Resolves a SPECIFIC (caller-chosen) batch for a course, for viewing
 * completed-course history — the counterpart to resolveCurrentBatchForCourse
 * above, which only ever resolves "whoever's current." No "is it current"
 * check here on purpose: a batch that has moved on is exactly the case this
 * exists for. Validates the batch actually has placement or enrollment
 * history in this course's class, so a made-up/unrelated batchId 400s
 * instead of silently returning an empty result.
 * See docs/superpowers/specs/2026-08-13-completed-course-history-design.md. */
export const resolveBatchForCourse = async (courseId: string, batchId: string): Promise<Batch> => {
  const course = await courseRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const batch = await batchRepository.findById(batchId);
  if (!batch) {
    throw new ApiError(404, 'Batch not found');
  }

  const hasHistory =
    (await classMembershipRepository.existsForClassAndBatch(course.classId, batchId)) ||
    (await enrollmentRepository.existsForCourseAndBatch(courseId, batchId));
  if (!hasHistory) {
    throw new ApiError(400, "This batch has no placement or enrollment history in this course's class.");
  }

  return batch;
};

/** Every batch that has ever had placement or enrollment history in this
 * course's class — current and past — most-recently-named first. Powers the
 * teacher/admin batch picker for viewing a course's completed-course history
 * (Gradebook/Assignments/Quizzes' batchId query param). Union of two
 * sources, same as resolveBatchForCourse's single-batch validation: sections
 * ever created for the class (the normal case) and enrollments that exist
 * without a formal section placement (ad hoc electives). */
export const listBatchesForCourse = async (courseId: string): Promise<Batch[]> => {
  const course = await courseRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }

  const [sections, enrollments] = await Promise.all([
    sectionRepository.findAll({ classId: course.classId }),
    enrollmentRepository.findAll({ courseId }),
  ]);
  const batchIds = new Set<string>([
    ...sections.map((s) => s.batchId),
    ...enrollments.map((e) => e.batchId),
  ]);

  return batchRepository.findByIds([...batchIds]);
};
