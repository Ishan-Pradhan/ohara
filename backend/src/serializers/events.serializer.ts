import type { Event } from '../models/events.model.js';

export const serializeEvent = (event: Event) => ({
  id: event.id,
  title: event.title,
  description: event.description,
  type: event.type,
  startAt: event.startAt.toISOString(),
  endAt: event.endAt?.toISOString() ?? null,
  allDay: event.allDay,
  audience: event.audience,
  institutionType: event.institutionType,
  programId: event.programId,
  classId: event.classId,
  createdBy: event.createdBy,
});

/** A birthday isn't a stored Event row — it's derived from a user's DOB and
 * projected onto whichever calendar year is being viewed, so it renders
 * through the same shape the frontend already knows how to draw. */
export const serializeBirthday = (
  user: { id: string; name: string },
  occurrence: Date,
) => ({
  id: `birthday-${user.id}-${occurrence.getFullYear()}`,
  title: `${user.name}'s birthday`,
  description: null,
  type: 'birthday' as const,
  startAt: occurrence.toISOString(),
  endAt: null,
  allDay: true,
  audience: 'global' as const,
  institutionType: null,
  programId: null,
  classId: null,
  createdBy: user.id,
});
