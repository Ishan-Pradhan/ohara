import type { Transaction } from 'sequelize';
import { sequelize } from '../config/db.js';
import { Enrollment } from '../models/enrollments.model.js';
import { Course } from '../models/courses.model.js';
import type { EnrollmentCreationAttributes } from '../types/placement.types.js';

export const enrollmentRepository = {
  create: async (data: EnrollmentCreationAttributes): Promise<Enrollment> => {
    return await Enrollment.create(data);
  },

  bulkCreate: async (
    data: EnrollmentCreationAttributes[],
    transaction?: Transaction,
    ignoreDuplicates = false,
  ): Promise<Enrollment[]> => {
    return await Enrollment.bulkCreate(data, { transaction, ignoreDuplicates });
  },

  findAll: async (options?: {
    studentId?: string;
    courseId?: string;
    batchId?: string;
  }): Promise<Enrollment[]> => {
    const where: Record<string, string> = {};
    if (options?.studentId) where.studentId = options.studentId;
    if (options?.courseId) where.courseId = options.courseId;
    if (options?.batchId) where.batchId = options.batchId;

    return await Enrollment.findAll({ where, order: [['createdAt', 'DESC']] });
  },

  /** Powers the FR-10 combined view (Task 4): active enrollments with course + teachers.
   * No batch/year filter needed — `bulkComplete` (below) already closes out every
   * enrollment from a student's previous class the moment they're promoted, so
   * `status: 'active'` alone already means "this student's current semester." */
  findActiveWithDetails: async (studentId: string): Promise<Enrollment[]> => {
    return await Enrollment.findAll({
      where: { studentId, status: 'active' },
      include: [{ association: 'course', include: ['teachers'] }],
    });
  },

  /** Completed counterpart to findActiveWithDetails — powers a student's
   * "Past courses" list (completed-course history) after promotion. Includes
   * `batch` so the frontend can pass it back as the batchId query param on
   * assignments/quizzes/gradebook when the student opens one of these. */
  findCompletedWithDetails: async (studentId: string): Promise<Enrollment[]> => {
    return await Enrollment.findAll({
      where: { studentId, status: 'completed' },
      include: [{ association: 'course', include: ['teachers'] }, 'batch'],
      order: [['createdAt', 'DESC']],
    });
  },

  /** Powers a course's roster view (teacher/admin) — active (`active`)
   * enrollments only. Promoted/dropped students are excluded so teachers
   * only see currently-enrolled students, not historical ones. */
  findByCourseWithStudents: async (courseId: string): Promise<Enrollment[]> => {
    return await Enrollment.findAll({
      where: { courseId, status: 'active' },
      include: ['student'],
      order: [['createdAt', 'ASC']],
    });
  },

  /** Historical counterpart to findByCourseWithStudents: every enrollment
   * for one SPECIFIC batch, any status — powers viewing a past batch's
   * gradebook after they've moved on, when 'active'-only would show
   * nothing (see docs/superpowers/specs/2026-08-13-completed-course-history-design.md). */
  findByCourseAndBatchWithStudents: async (courseId: string, batchId: string): Promise<Enrollment[]> => {
    return await Enrollment.findAll({
      where: { courseId, batchId },
      include: ['student'],
      order: [['createdAt', 'ASC']],
    });
  },

  /** Powers requireEnrolledStudent — the *write* gate (submit an
   * assignment, attempt a quiz). Active enrollment only — a `dropped` or
   * `completed` enrollment shouldn't grant write access. */
  isEnrolled: async (studentId: string, courseId: string): Promise<boolean> => {
    const found = await Enrollment.findOne({
      where: { studentId, courseId, status: 'active' },
    });
    return found !== null;
  },

  /** Powers requireCourseAccess — the *read* gate. Active OR completed: a
   * promoted student keeps read access to their own past coursework
   * (grades/attendance/assignments/quizzes), just never write access
   * (isEnrolled, above, still gates that). A `dropped` enrollment still has
   * no access at all, same as before. */
  hasEverEnrolled: async (studentId: string, courseId: string): Promise<boolean> => {
    const found = await Enrollment.findOne({
      where: { studentId, courseId, status: ['active', 'completed'] },
    });
    return found !== null;
  },

  /** Does this batch have any enrollment history in this course at all?
   * Powers courses.controller.ts's resolveBatchForCourse — validates a
   * caller-supplied batchId isn't just made up. */
  existsForCourseAndBatch: async (courseId: string, batchId: string): Promise<boolean> => {
    const found = await Enrollment.findOne({ where: { courseId, batchId } });
    return found !== null;
  },

  /** Active-enrollment headcount per course — powers the fill-vs-capacity
   * display for electives, same shape as classMembershipRepository.countBySections. */
  countByCourses: async (courseIds: string[]): Promise<Record<string, number>> => {
    if (courseIds.length === 0) return {};

    const rows = (await Enrollment.findAll({
      where: { courseId: courseIds, status: 'active' },
      attributes: ['courseId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['courseId'],
      raw: true,
    })) as unknown as { courseId: string; count: string }[];

    return Object.fromEntries(rows.map((r) => [r.courseId, Number(r.count)]));
  },

  /** One row per (student, course, batch) by the unique constraint — powers
   * self-enroll's re-enroll-after-drop reactivation path. */
  findByStudentCourseBatch: async (
    studentId: string,
    courseId: string,
    batchId: string,
  ): Promise<Enrollment | null> => {
    return await Enrollment.findOne({ where: { studentId, courseId, batchId } });
  },

  setStatus: async (
    id: string,
    status: 'active' | 'completed' | 'dropped',
  ): Promise<Enrollment | null> => {
    const enrollment = await Enrollment.findByPk(id);
    if (!enrollment) return null;
    return await enrollment.update({ status });
  },

  /** Marks every active enrollment for a student in a given *class*'s
   * courses as `completed`. Called inside promote()/reassign() so that when
   * a student moves to the next semester, teachers in the old semester's
   * courses no longer see them on the roster. Keyed on classId, not batchId
   * — a student's batch never changes across a normal promotion, so a
   * batchId filter would (wrongly) also match the enrollments the promotion
   * is about to create. */
  bulkComplete: async (
    studentId: string,
    classId: string,
    transaction: Transaction,
  ): Promise<void> => {
    const courses = await Course.findAll({ where: { classId }, attributes: ['id'], transaction });
    const courseIds = courses.map((c) => c.id);
    if (courseIds.length === 0) return;
    await Enrollment.update(
      { status: 'completed' },
      { where: { studentId, courseId: courseIds, status: 'active' }, transaction },
    );
  },
};
