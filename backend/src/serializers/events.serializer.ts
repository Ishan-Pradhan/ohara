import type { Event } from '../models/events.model.js';

export const serializeEvent = (event: Event) => ({
  id: event.id,
  title: event.title,
  description: event.description,
  startAt: event.startAt.toISOString(),
  audience: event.audience,
  programId: event.programId,
  classId: event.classId,
  sectionId: event.sectionId,
  courseId: event.courseId,
  createdBy: event.createdBy,
});
