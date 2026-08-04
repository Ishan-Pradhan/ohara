import type { Module } from '../models/modules.model.js';
import type { Lesson } from '../models/lessons.model.js';

export const serializeLesson = (l: Lesson) => ({
  id: l.id,
  moduleId: l.moduleId,
  title: l.title,
  content: l.content,
  keyTopics: l.keyTopics,
  orderIndex: l.orderIndex,
  createdAt: l.createdAt,
});

export const serializeModule = (m: Module) => ({
  id: m.id,
  courseId: m.courseId,
  title: m.title,
  orderIndex: m.orderIndex,
  createdAt: m.createdAt,
  lessons: (m.lessons ?? []).map(serializeLesson),
});
