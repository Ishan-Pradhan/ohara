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

/** Outline view for the student-facing course page — the same shape as the
 * teacher's serializeLesson (students read lesson content directly, not
 * only through the tutor chat), just without createdAt (irrelevant to a
 * student's reading view). */
export const serializeLessonOutline = (l: Lesson) => ({
  id: l.id,
  moduleId: l.moduleId,
  title: l.title,
  content: l.content,
  keyTopics: l.keyTopics,
  orderIndex: l.orderIndex,
});

export const serializeModuleOutline = (m: Module) => ({
  id: m.id,
  courseId: m.courseId,
  title: m.title,
  orderIndex: m.orderIndex,
  lessons: (m.lessons ?? []).map(serializeLessonOutline),
});
