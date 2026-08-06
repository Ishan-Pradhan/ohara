import { AttendanceSession } from '../models/attendanceSessions.model.js';
import type { AttendanceSessionCreationAttributes } from '../types/attendance.types.js';

export const attendanceSessionRepository = {
  create: async (data: AttendanceSessionCreationAttributes): Promise<AttendanceSession> => {
    return await AttendanceSession.create(data);
  },

  findAllByCourse: async (courseId: string): Promise<AttendanceSession[]> => {
    return await AttendanceSession.findAll({
      where: { courseId },
      order: [['sessionDate', 'DESC']],
    });
  },

  findById: async (id: string): Promise<AttendanceSession | null> => {
    return await AttendanceSession.findByPk(id, {
      include: [{ association: 'records', include: ['student'] }],
    });
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await AttendanceSession.destroy({ where: { id } });
    return deleted > 0;
  },
};
