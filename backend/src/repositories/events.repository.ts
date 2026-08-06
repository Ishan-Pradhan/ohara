import { Op, type WhereOptions } from 'sequelize';

import { Event } from '../models/events.model.js';
import type { EventCreationAttributes } from '../types/events.types.js';
import type { InstitutionType } from '../types/institution.types.js';

interface RelevantScope {
  institutionTypes: InstitutionType[];
  programIds: string[];
  classIds: string[];
}

/** An event with no `endAt` is a single point in time at `startAt`; one
 * with `endAt` spans a range (e.g. a multi-day holiday). Either way it
 * overlaps [from, to] when it starts on/before `to` and ends on/after
 * `from`. Wrapped in its own `Op.and` so a caller can safely combine it
 * with a second `Op.or` (e.g. audience scoping) without either clobbering
 * the other under the same object key. */
const rangeOverlap = (from: Date, to: Date): WhereOptions => ({
  [Op.and]: [
    { startAt: { [Op.lte]: to } },
    { [Op.or]: [{ endAt: { [Op.gte]: from } }, { endAt: null, startAt: { [Op.gte]: from } }] },
  ],
});

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

  /** Admin sees every event in range — no scope filter. */
  findAllInRange: async (from: Date, to: Date): Promise<Event[]> => {
    return await Event.findAll({ where: rangeOverlap(from, to), order: [['startAt', 'ASC']] });
  },

  findRelevantInRange: async (scope: RelevantScope, from: Date, to: Date): Promise<Event[]> => {
    const or: Record<string, unknown>[] = [{ audience: 'global' }];
    if (scope.institutionTypes.length > 0) {
      or.push({ audience: 'institution_type', institutionType: scope.institutionTypes });
    }
    if (scope.programIds.length > 0) or.push({ audience: 'program', programId: scope.programIds });
    if (scope.classIds.length > 0) or.push({ audience: 'class', classId: scope.classIds });

    return await Event.findAll({
      where: { [Op.and]: [rangeOverlap(from, to), { [Op.or]: or }] },
      order: [['startAt', 'ASC']],
    });
  },
};
