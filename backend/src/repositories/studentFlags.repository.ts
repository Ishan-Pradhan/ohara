import { StudentFlag } from '../models/studentFlags.model.js';
import { STUDENT_FLAG_STATUSES } from '../constants/index.js';
import type { StudentFlagCreationAttributes } from '../types/studentFlags.types.js';

export const studentFlagRepository = {
  create: async (data: StudentFlagCreationAttributes): Promise<StudentFlag> => {
    return await StudentFlag.create(data);
  },

  /** Powers the admin-facing view on a student's detail page. */
  findByStudentId: async (studentId: string): Promise<StudentFlag[]> => {
    return await StudentFlag.findAll({
      where: { studentId },
      include: ['raiser'],
      order: [['createdAt', 'DESC']],
    });
  },

  findById: async (id: string): Promise<StudentFlag | null> => {
    return await StudentFlag.findByPk(id);
  },

  resolve: async (id: string): Promise<StudentFlag | null> => {
    const flag = await StudentFlag.findByPk(id);
    if (!flag) return null;
    return await flag.update({ status: STUDENT_FLAG_STATUSES.RESOLVED });
  },
};
