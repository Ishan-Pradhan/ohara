import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  moduleSchema,
  lessonSchema,
  type Module,
  type Lesson,
  type CreateModuleInput,
  type CreateLessonInput,
} from './courseContent.schema.js';

export const generateStructure = async (
  courseId: string,
  documentId: string,
): Promise<Module[]> => {
  const res = await api.post(`/courses/${courseId}/documents/${documentId}/generate`);
  return z.array(moduleSchema).parse(res.data.data);
};

export const fetchModules = async (courseId: string): Promise<Module[]> => {
  const res = await api.get(`/courses/${courseId}/modules`);
  return z.array(moduleSchema).parse(res.data.data);
};

export const createModule = async (
  courseId: string,
  input: CreateModuleInput,
): Promise<Module> => {
  const res = await api.post(`/courses/${courseId}/modules`, input);
  return moduleSchema.parse(res.data.data);
};

export const updateModule = async (
  courseId: string,
  moduleId: string,
  input: Partial<CreateModuleInput>,
): Promise<Module> => {
  const res = await api.patch(`/courses/${courseId}/modules/${moduleId}`, input);
  return moduleSchema.parse(res.data.data);
};

export const deleteModule = async (courseId: string, moduleId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/modules/${moduleId}`);
};

export const createLesson = async (
  courseId: string,
  moduleId: string,
  input: CreateLessonInput,
): Promise<Lesson> => {
  const res = await api.post(`/courses/${courseId}/modules/${moduleId}/lessons`, input);
  return lessonSchema.parse(res.data.data);
};

export const updateLesson = async (
  courseId: string,
  moduleId: string,
  lessonId: string,
  input: Partial<CreateLessonInput>,
): Promise<Lesson> => {
  const res = await api.patch(
    `/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
    input,
  );
  return lessonSchema.parse(res.data.data);
};

export const deleteLesson = async (
  courseId: string,
  moduleId: string,
  lessonId: string,
): Promise<void> => {
  await api.delete(`/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
};

export const publishCourse = async (
  courseId: string,
  isPublished: boolean,
): Promise<{ id: string; isPublished: boolean }> => {
  const res = await api.patch(`/courses/${courseId}/publish`, { isPublished });
  return res.data.data;
};

export interface CourseBatch {
  id: string;
  name: string;
}

/** Every batch that has ever had placement/enrollment history in this
 * course's class, current and past — powers the teacher/admin batch picker
 * for viewing completed-course history. */
export const fetchCourseBatches = async (courseId: string): Promise<CourseBatch[]> => {
  const res = await api.get(`/courses/${courseId}/batches`);
  return res.data.data as CourseBatch[];
};
