import { sequelize } from '../config/db.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { Batch } from '../models/batches.model.js';
import { enrollmentRepository } from './enrollments.repository.js';
import { userRepository } from './users.repository.js';
import { CLASS_MEMBERSHIP_OUTCOMES } from '../constants/index.js';
import type {
  ClassMembershipCreationAttributes,
  ClassMembershipOutcome,
  EnrollmentCreationAttributes,
} from '../types/placement.types.js';

export const classMembershipRepository = {
  /**
   * Creates the placement and, if `autoEnrollCourseIds` is non-empty, bulk-creates one
   * `active` enrollment per course in the same transaction. `autoEnrollCourseIds` is resolved
   * by the controller (courseRepository.findAll({classId}) when the target class has
   * compulsory courses) before calling this.
   */
  create: async (
    data: ClassMembershipCreationAttributes,
    autoEnrollCourseIds: string[] = [],
  ): Promise<ClassMembership> => {
    return await sequelize.transaction(async (transaction) => {
      const membership = await ClassMembership.create(data, { transaction });

      if (autoEnrollCourseIds.length > 0) {
        const enrollments: EnrollmentCreationAttributes[] = autoEnrollCourseIds.map(
          (courseId) => ({
            studentId: data.studentId,
            courseId,
            batchId: data.batchId,
          }),
        );
        await enrollmentRepository.bulkCreate(enrollments, transaction);
      }

      return membership;
    });
  },

  findAll: async (options?: {
    studentId?: string;
    sectionId?: string;
    classId?: string;
  }): Promise<ClassMembership[]> => {
    const where: Record<string, string> = {};
    if (options?.studentId) where.studentId = options.studentId;
    if (options?.sectionId) where.sectionId = options.sectionId;
    if (options?.classId) where.classId = options.classId;

    return await ClassMembership.findAll({ where, order: [['createdAt', 'DESC']] });
  },

  /** A student's current placement is the head of their promotion chain — the
   * one membership not yet superseded by a later promote()/graduate() call. */
  findCurrent: async (studentId: string): Promise<ClassMembership | null> => {
    return await ClassMembership.findOne({
      where: { studentId, promotedToId: null },
      include: [
        {
          association: 'section',
          include: [{ association: 'class', include: ['program'] }],
        },
        'batch',
      ],
    });
  },

  findById: async (id: string): Promise<ClassMembership | null> => {
    return await ClassMembership.findByPk(id);
  },

  /** Active (not yet promoted/transferred/graduated out) headcount per section —
   * powers the fill-vs-capacity display in the Structure explorer and the
   * admission form's section picker. */
  countBySections: async (sectionIds: string[]): Promise<Record<string, number>> => {
    if (sectionIds.length === 0) return {};

    const rows = (await ClassMembership.findAll({
      where: { sectionId: sectionIds, outcome: CLASS_MEMBERSHIP_OUTCOMES.ENROLLED },
      attributes: ['sectionId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['sectionId'],
      raw: true,
    })) as unknown as { sectionId: string; count: string }[];

    return Object.fromEntries(rows.map((r) => [r.sectionId, Number(r.count)]));
  },

  /** Which class(es)/section(s) a batch is placed in *right now* —
   * `outcome: 'enrolled'` only. Powers "mark and auto-select the current
   * semester" in the Attendance/Gradebook/At-Risk/Transcripts batch pickers,
   * which otherwise browse a batch's full history (`classRepository
   * .findAll({batchId})` / `sectionRepository.findAll({batchId})` — neither
   * filters by outcome, on purpose, so past semesters stay reachable).
   * Usually resolves to exactly one class/section, but a batch's cohort can
   * legitimately be split across two adjacent classes if promotion hasn't
   * been applied uniformly to every student yet — this returns all of them,
   * not just one, so the caller doesn't silently drop a real placement. */
  findCurrentForBatch: async (batchId: string): Promise<{ classId: string; sectionId: string }[]> => {
    const memberships = await ClassMembership.findAll({
      where: { batchId, outcome: CLASS_MEMBERSHIP_OUTCOMES.ENROLLED },
      attributes: ['sectionId', 'classId'],
    });
    const seen = new Set<string>();
    const result: { classId: string; sectionId: string }[] = [];
    for (const m of memberships) {
      const key = `${m.classId}:${m.sectionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ classId: m.classId, sectionId: m.sectionId });
    }
    return result;
  },

  /** Every batch currently placed in `classId` (`outcome: 'enrolled'`), most
   * populated first. This is the direct, structural answer to "who's really
   * here now" — it replaces the old year-matching fallback chain entirely
   * (courses.controller.ts's `resolveCurrentBatchForCourse`,
   * attendance.controller.ts's batch resolver): a batch's `outcome:
   * 'enrolled'` memberships ARE its current placement, no inference needed.
   * Usually one row; more than one only if a class currently holds students
   * from more than one batch (promotion applied non-uniformly, or two
   * batches' schedules happen to overlap here). */
  countEnrolledByClassGroupedByBatch: async (
    classId: string,
  ): Promise<{ batchId: string; count: number }[]> => {
    const rows = (await ClassMembership.findAll({
      where: { classId, outcome: CLASS_MEMBERSHIP_OUTCOMES.ENROLLED },
      attributes: ['batchId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['batchId'],
      order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
      raw: true,
    })) as unknown as { batchId: string; count: string }[];

    return rows.map((r) => ({ batchId: r.batchId, count: Number(r.count) }));
  },

  /** Resolves the same "who's really here now" question as
   * countEnrolledByClassGroupedByBatch above, but as a single winner —
   * courses.controller.ts's resolveCurrentBatchForCourseOrNull and
   * attendance.controller.ts's resolveRelevantAttendanceBatch both need to
   * agree on exactly one answer, so this is the one place that decides it,
   * rather than each re-implementing the same tiebreak.
   *
   * During a promotion window a class can legitimately hold `enrolled` rows
   * from two batches at once: the outgoing batch's not-yet-promoted
   * stragglers, and the incoming batch's freshly-placed students. The
   * outgoing batch is usually still the larger of the two until promotion
   * finishes catching up, so picking "most populated" (as
   * countEnrolledByClassGroupedByBatch's own ordering does) keeps pointing
   * at the batch that's on its way out — it looks "stuck" on the old batch
   * for as long as the transition takes. Recency is the more useful signal
   * here: prefer whichever candidate batch was created most recently, since
   * a newer batch coexisting with an older one in the same class is by
   * definition the incoming one. */
  findCurrentBatchIdForClass: async (classId: string): Promise<string | null> => {
    const candidates = await classMembershipRepository.countEnrolledByClassGroupedByBatch(classId);
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0]!.batchId;

    const batches = await Batch.findAll({ where: { id: candidates.map((c) => c.batchId) } });
    const newest = [...batches].sort(
      (a, b) =>
        new Date(b.createdAt as unknown as string).getTime() -
        new Date(a.createdAt as unknown as string).getTime(),
    )[0];
    return newest?.id ?? candidates[0]!.batchId;
  },

  /** Does this batch have any placement history in this class at all —
   * past or present? Powers courses.controller.ts's resolveBatchForCourse
   * (validates a caller-supplied batchId isn't just made up), unlike
   * countEnrolledByClassGroupedByBatch above which is current-only. */
  existsForClassAndBatch: async (classId: string, batchId: string): Promise<boolean> => {
    const found = await ClassMembership.findOne({ where: { classId, batchId } });
    return found !== null;
  },

  updateSection: async (id: string, sectionId: string): Promise<ClassMembership | null> => {
    const membership = await ClassMembership.findByPk(id);
    if (!membership) return null;
    membership.sectionId = sectionId;
    await membership.save();
    return membership;
  },

  /** Atomically creates the new membership (+ auto-enroll) and closes out the old one.
   * Also marks all of the student's active enrollments for the old class as `completed`
   * so teachers in those courses no longer see the student on their roster. */
  promote: async (
    oldMembershipId: string,
    newData: ClassMembershipCreationAttributes,
    outcome: ClassMembershipOutcome,
    autoEnrollCourseIds: string[] = [],
  ): Promise<ClassMembership> => {
    return await sequelize.transaction(async (transaction) => {
      const newMembership = await ClassMembership.create(newData, { transaction });

      if (autoEnrollCourseIds.length > 0) {
        const enrollments: EnrollmentCreationAttributes[] = autoEnrollCourseIds.map(
          (courseId) => ({
            studentId: newData.studentId,
            courseId,
            batchId: newData.batchId,
          }),
        );
        await enrollmentRepository.bulkCreate(enrollments, transaction);
      }

      const oldMembership = await ClassMembership.findByPk(oldMembershipId, { transaction });
      if (!oldMembership) {
        throw new Error('Class membership disappeared mid-transaction');
      }

      // Complete all active enrollments from the old semester so the student
      // no longer appears on any teacher's course roster for that class.
      await enrollmentRepository.bulkComplete(
        oldMembership.studentId,
        oldMembership.classId,
        transaction,
      );

      oldMembership.outcome = outcome;
      oldMembership.promotedToId = newMembership.id;
      await oldMembership.save({ transaction });

      return newMembership;
    });
  },

  /** Atomically graduates the student (status + cleared refresh token) and closes out the membership. */
  graduate: async (id: string, studentId: string): Promise<ClassMembership> => {
    return await sequelize.transaction(async (transaction) => {
      await userRepository.updateStatusInTransaction(studentId, 'graduated', transaction);

      const membership = await ClassMembership.findByPk(id, { transaction });
      if (!membership) {
        throw new Error('Class membership disappeared mid-transaction');
      }
      membership.outcome = 'graduated';
      membership.promotedToId = null;
      await membership.save({ transaction });

      return membership;
    });
  },

  /**
   * Reassigns a student's current placement to an arbitrary section + batch —
   * any program, class, or batch (the correction tool for a mis-placement —
   * distinct from promotion, which never changes a student's batch; this is
   * the explicit admin override for fixing a mistake).
   *
   * - **Same class:** the UNIQUE(studentId, classId) index forbids a second
   *   row, so the existing membership is moved in place and its active
   *   enrollments are resynced to the target section's batch (old
   *   enrollments completed, target class's compulsory courses
   *   auto-enrolled under the new batch).
   * - **Different class:** mirrors `promote` — a new membership is opened,
   *   the old one is closed out with outcome `transferred` (readable history
   *   in the promotion chain), and its enrollments completed.
   */
  reassign: async (
    oldMembershipId: string,
    newData: ClassMembershipCreationAttributes,
    autoEnrollCourseIds: string[] = [],
  ): Promise<ClassMembership> => {
    return await sequelize.transaction(async (transaction) => {
      const oldMembership = await ClassMembership.findByPk(oldMembershipId, { transaction });
      if (!oldMembership) {
        throw new Error('Class membership disappeared mid-transaction');
      }

      if (oldMembership.classId === newData.classId) {
        oldMembership.sectionId = newData.sectionId;
        oldMembership.batchId = newData.batchId;
        await oldMembership.save({ transaction });

        await enrollmentRepository.bulkComplete(
          oldMembership.studentId,
          oldMembership.classId,
          transaction,
        );
        if (autoEnrollCourseIds.length > 0) {
          const enrollments = autoEnrollCourseIds.map((courseId) => ({
            studentId: oldMembership.studentId,
            courseId,
            batchId: newData.batchId,
          }));
          await enrollmentRepository.bulkCreate(enrollments, transaction, true);
        }

        return oldMembership;
      }

      const newMembership = await ClassMembership.create(newData, { transaction });
      if (autoEnrollCourseIds.length > 0) {
        const enrollments = autoEnrollCourseIds.map((courseId) => ({
          studentId: newData.studentId,
          courseId,
          batchId: newData.batchId,
        }));
        await enrollmentRepository.bulkCreate(enrollments, transaction);
      }
      await enrollmentRepository.bulkComplete(
        oldMembership.studentId,
        oldMembership.classId,
        transaction,
      );
      oldMembership.outcome = CLASS_MEMBERSHIP_OUTCOMES.TRANSFERRED;
      oldMembership.promotedToId = newMembership.id;
      await oldMembership.save({ transaction });

      return newMembership;
    });
  },

  /** Powers a section's roster view (class teacher/admin) — active (`enrolled`)
   * memberships only, each row's `student` included. */
  findBySectionWithStudents: async (sectionId: string): Promise<ClassMembership[]> => {
    return await ClassMembership.findAll({
      where: { sectionId, outcome: CLASS_MEMBERSHIP_OUTCOMES.ENROLLED },
      include: ['student'],
      order: [['createdAt', 'ASC']],
    });
  },
};
