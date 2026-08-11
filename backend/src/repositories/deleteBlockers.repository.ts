import { Batch } from '../models/batches.model.js';
import { Class } from '../models/classes.model.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { Course } from '../models/courses.model.js';
import { Document } from '../models/documents.model.js';
import { Enrollment } from '../models/enrollments.model.js';
import { Event } from '../models/events.model.js';
import { Intervention } from '../models/intervention.model.js';
import { Project } from '../models/projects.model.js';
import { QuizAttempt } from '../models/quizAttempts.model.js';
import { Section } from '../models/sections.model.js';
import { StudyPlan } from '../models/studyPlan.model.js';
import { Submission } from '../models/submissions.model.js';
import type { DeleteBlocker } from '../types/deleteBlockers.types.js';

/**
 * Computes what still references an entity and would block its deletion.
 *
 * This is the explicit, admin-facing half of the deletion guard. The database
 * `ON DELETE RESTRICT` constraints remain the authoritative backstop (so the
 * guard can't be tricked by a race), but instead of a generic FK error the
 * delete controllers now report exactly which records reference the entity and
 * what to remove first.
 *
 * Each method mirrors the RESTRICT FKs declared in the migrations — keep them
 * in step if a migration adds or changes a RESTRICT constraint.
 */

const where = (model: { count: (o: { where: Record<string, string> }) => Promise<number> },
  conditions: Record<string, string>) => model.count({ where: conditions });

export const deleteBlockersRepository = {
  programBlockers: async (programId: string): Promise<DeleteBlocker[]> => {
    const blockers: DeleteBlocker[] = [];

    const classes = await Class.count({ where: { programId } });
    if (classes > 0) {
      blockers.push({
        entity: 'class',
        label: 'classes',
        singular: 'class',
        count: classes,
        hint: 'Delete or move its classes (and their sections/courses) first.',
        category: 'ownership',
      });
    }

    const batches = await Batch.count({ where: { programId } });
    if (batches > 0) {
      blockers.push({
        entity: 'batch',
        label: 'batches',
        singular: 'batch',
        count: batches,
        hint: 'Delete its batches (and the students placed under them) first.',
        category: 'ownership',
      });
    }

    return blockers;
  },

  classBlockers: async (classId: string): Promise<DeleteBlocker[]> => {
    const blockers: DeleteBlocker[] = [];

    const sections = await Section.count({ where: { classId } });
    if (sections > 0) {
      blockers.push({
        entity: 'section',
        label: 'sections',
        singular: 'section',
        count: sections,
        hint: 'Delete its sections (and the students placed in them) first.',
        category: 'ownership',
      });
    }

    const courses = await Course.count({ where: { classId } });
    if (courses > 0) {
      blockers.push({
        entity: 'course',
        label: 'courses',
        singular: 'course',
        count: courses,
        hint: 'Delete its courses first.',
        category: 'ownership',
      });
    }

    return blockers;
  },

  batchBlockers: async (batchId: string): Promise<DeleteBlocker[]> => {
    const blockers: DeleteBlocker[] = [];

    const memberships = await ClassMembership.count({ where: { batchId } });
    if (memberships > 0) {
      blockers.push({
        entity: 'placement',
        label: 'student placements',
        singular: 'student placement',
        count: memberships,
        hint: 'Transfer or remove the students placed under this batch first.',
        category: 'ownership',
      });
    }

    return blockers;
  },

  academicYearBlockers: async (academicYearId: string): Promise<DeleteBlocker[]> => {
    const blockers: DeleteBlocker[] = [];

    const sections = await Section.count({ where: { academicYearId } });
    if (sections > 0) {
      blockers.push({
        entity: 'section',
        label: 'sections',
        singular: 'section',
        count: sections,
        hint: 'Delete its sections (and the students placed in them) first.',
        category: 'ownership',
      });
    }

    const batches = await Batch.count({ where: { startAcademicYearId: academicYearId } });
    if (batches > 0) {
      blockers.push({
        entity: 'batch',
        label: 'batches',
        singular: 'batch',
        count: batches,
        hint: 'Delete or re-date its batches first.',
        category: 'ownership',
      });
    }

    const memberships = await ClassMembership.count({ where: { academicYearId } });
    if (memberships > 0) {
      blockers.push({
        entity: 'placement',
        label: 'student placements',
        singular: 'student placement',
        count: memberships,
        hint: 'Promote, transfer, or remove the students placed in this academic year first.',
        category: 'ownership',
      });
    }

    const enrollments = await Enrollment.count({ where: { academicYearId } });
    if (enrollments > 0) {
      blockers.push({
        entity: 'enrollment',
        label: 'course enrollments',
        singular: 'course enrollment',
        count: enrollments,
        hint: 'Move the students in this academic year first — their course enrollments go with them.',
        category: 'ownership',
      });
    }

    return blockers;
  },

  sectionBlockers: async (sectionId: string): Promise<DeleteBlocker[]> => {
    const blockers: DeleteBlocker[] = [];

    const memberships = await ClassMembership.count({ where: { sectionId } });
    if (memberships > 0) {
      blockers.push({
        entity: 'placement',
        label: 'student placements',
        singular: 'student placement',
        count: memberships,
        hint: 'Transfer or remove the students placed in this section first.',
        category: 'ownership',
      });
    }

    return blockers;
  },

  /** A student's hard-delete is blocked by every RESTRICT record they own.
   * Soft-delete (archive) is the normal path; this only tells an admin what
   * stands in the way of the rare, explicit permanent removal.
   *
   * Blockers are split into two categories:
   * - `academic_record`: immutable transcript evidence (placements, enrollments,
   *   submissions, quiz attempts, interventions, study plans). These cannot be
   *   removed — hard deletion is simply not available for students who have them.
   *   The admin should Archive instead.
   * - `ownership`: artifacts the student created (projects, documents, events).
   *   These can be deleted or reassigned, after which hard deletion proceeds. */
  studentBlockers: async (studentId: string): Promise<DeleteBlocker[]> => {
    const blockers: DeleteBlocker[] = [];

    const placements = await where(ClassMembership, { studentId });
    if (placements > 0) {
      blockers.push({
        entity: 'placement',
        label: 'class placements',
        singular: 'class placement',
        count: placements,
        hint: 'Permanent academic record — hard deletion is not available for students with placement history. Archive to revoke access while preserving the record.',
        category: 'academic_record',
      });
    }

    const enrollments = await where(Enrollment, { studentId });
    if (enrollments > 0) {
      blockers.push({
        entity: 'enrollment',
        label: 'course enrollments',
        singular: 'course enrollment',
        count: enrollments,
        hint: 'Permanent academic record — these enrollments are part of the student\'s transcript and cannot be removed.',
        category: 'academic_record',
      });
    }

    const submissions = await where(Submission, { studentId });
    if (submissions > 0) {
      blockers.push({
        entity: 'submission',
        label: 'assignment submissions',
        singular: 'assignment submission',
        count: submissions,
        hint: 'Permanent academic record — submissions are part of the student\'s grades and cannot be removed.',
        category: 'academic_record',
      });
    }

    const quizAttempts = await where(QuizAttempt, { studentId });
    if (quizAttempts > 0) {
      blockers.push({
        entity: 'quiz_attempt',
        label: 'quiz attempts',
        singular: 'quiz attempt',
        count: quizAttempts,
        hint: 'Permanent academic record — quiz results are part of the student\'s transcript and cannot be removed.',
        category: 'academic_record',
      });
    }

    const interventions = await where(Intervention, { studentId });
    if (interventions > 0) {
      blockers.push({
        entity: 'intervention',
        label: 'interventions',
        singular: 'intervention',
        count: interventions,
        hint: 'Permanent academic record — intervention history cannot be removed.',
        category: 'academic_record',
      });
    }

    const studyPlans = await where(StudyPlan, { studentId });
    if (studyPlans > 0) {
      blockers.push({
        entity: 'study_plan',
        label: 'study plans',
        singular: 'study plan',
        count: studyPlans,
        hint: 'Permanent academic record — study plan history cannot be removed.',
        category: 'academic_record',
      });
    }

    const projects = await where(Project, { ownerId: studentId });
    if (projects > 0) {
      blockers.push({
        entity: 'project',
        label: 'kanban projects',
        singular: 'kanban project',
        count: projects,
        hint: 'Owned artifact — delete or reassign these projects before hard-deleting the student.',
        category: 'ownership',
      });
    }

    const documents = await where(Document, { uploadedBy: studentId });
    if (documents > 0) {
      blockers.push({
        entity: 'document',
        label: 'uploaded documents',
        singular: 'uploaded document',
        count: documents,
        hint: 'Owned artifact — delete these documents before hard-deleting the student.',
        category: 'ownership',
      });
    }

    const events = await where(Event, { createdBy: studentId });
    if (events > 0) {
      blockers.push({
        entity: 'event',
        label: 'created events',
        singular: 'created event',
        count: events,
        hint: 'Owned artifact — delete or reassign these events before hard-deleting the student.',
        category: 'ownership',
      });
    }

    return blockers;
  },
};
