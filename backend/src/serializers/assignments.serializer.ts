import type { Assignment } from '../models/assignments.model.js';

export const serializeAssignment = (a: Assignment) => ({
  id: a.id,
  courseId: a.courseId,
  title: a.title,
  prompt: a.prompt,
  rubric: a.rubric,
  dueAt: a.dueAt,
  createdAt: a.createdAt,
});
