import { Assignment } from '../models/assignments.model.js';
import type {
  AssignmentAttributes,
  AssignmentCreationAttributes,
} from '../types/assignments.types.js';

export const assignmentRepository = {
  create: async (data: AssignmentCreationAttributes): Promise<Assignment> => {
    return await Assignment.create(data);
  },

  /** academicYearId is required (not optional) so every call site is forced
   * to decide which year's assignments it wants — a Course is permanently
   * attached to its Class and reused by every future batch, so listing
   * without a year filter would resurface every past batch's assignments. */
  findAllByCourse: async (courseId: string, academicYearId: string): Promise<Assignment[]> => {
    return await Assignment.findAll({
      where: { courseId, academicYearId },
      order: [['dueAt', 'ASC']],
    });
  },

  findById: async (id: string): Promise<Assignment | null> => {
    return await Assignment.findByPk(id);
  },

  update: async (
    id: string,
    data: Partial<Pick<AssignmentAttributes, 'title' | 'prompt' | 'rubric' | 'dueAt'>>,
  ): Promise<Assignment | null> => {
    const assignment = await Assignment.findByPk(id);
    if (!assignment) return null;
    return await assignment.update(data);
  },

  /** Submissions/grades cascade at the DB level (ON DELETE CASCADE) —
   * the assignment is the aggregate root for its own submissions. */
  delete: async (id: string): Promise<boolean> => {
    const deleted = await Assignment.destroy({ where: { id } });
    return deleted > 0;
  },
};
