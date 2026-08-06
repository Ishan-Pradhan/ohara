import { Op } from 'sequelize';

import { Event } from '../models/events.model.js';
import type { EventCreationAttributes } from '../types/events.types.js';

interface RelevantScope {
  courseIds: string[];
  classIds: string[];
  sectionIds: string[];
  programIds: string[];
}

export const eventRepository = {
  create: async (data: EventCreationAttributes): Promise<Event> => {
    return await Event.create(data);
  },

  findById: async (id: string): Promise<Event | null> => {
    return await Event.findByPk(id);
  },

  delete: async (id: string): Promise<boolean> => {
    const deleted = await Event.destroy({ where: { id } });
    return deleted > 0;
  },

  /** Every upcoming global event, plus any upcoming scoped event whose
   * program/class/section/course id is in the caller's own scope — the
   * caller (controller) resolves that scope from placement/enrollment or
   * teaching assignments; this only does the OR query. */
  findAllUpcoming: async (): Promise<Event[]> => {
    return await Event.findAll({
      where: { startAt: { [Op.gte]: new Date() } },
      order: [['startAt', 'ASC']],
    });
  },

  findUpcomingRelevantTo: async (scope: RelevantScope): Promise<Event[]> => {
    const or: Record<string, unknown>[] = [{ audience: 'global' }];
    if (scope.programIds.length > 0) or.push({ audience: 'program', programId: scope.programIds });
    if (scope.classIds.length > 0) or.push({ audience: 'class', classId: scope.classIds });
    if (scope.sectionIds.length > 0) or.push({ audience: 'section', sectionId: scope.sectionIds });
    if (scope.courseIds.length > 0) or.push({ audience: 'course', courseId: scope.courseIds });

    return await Event.findAll({
      where: { startAt: { [Op.gte]: new Date() }, [Op.or]: or },
      order: [['startAt', 'ASC']],
    });
  },
};
