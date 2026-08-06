import { Assignment } from '../models/assignments.model.js';
import type {
  AssignmentAttributes,
  AssignmentCreationAttributes,
} from '../types/assignments.types.js';

export const assignmentRepository = {
  create: async (data: AssignmentCreationAttributes): Promise<Assignment> => {
    return await Assignment.create(data);
  },

  findAllByCourse: async (courseId: string): Promise<Assignment[]> => {
    return await Assignment.findAll({
      where: { courseId },
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
