import { StudentProfile } from '../models/studentProfiles.model.js';
import type { StudentProfileCreationAttributes } from '../types/studentProfiles.types.js';

export const studentProfileRepository = {
  findByUserId: async (userId: string): Promise<StudentProfile | null> => {
    return await StudentProfile.findOne({ where: { userId } });
  },

  /** Creates the row on first use, or updates the existing one — a student
   * has at most one profile, and the admission form is expected to be the
   * only writer for now. */
  upsert: async (
    userId: string,
    data: Omit<StudentProfileCreationAttributes, 'id' | 'userId'>,
  ): Promise<StudentProfile> => {
    const existing = await StudentProfile.findOne({ where: { userId } });
    if (existing) {
      return await existing.update(data);
    }
    return await StudentProfile.create({ userId, ...data });
  },
};
