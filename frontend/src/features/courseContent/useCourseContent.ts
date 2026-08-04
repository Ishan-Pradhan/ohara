import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { COURSES_KEY } from '../institution/useInstitution.js';
import {
  generateStructure,
  fetchModules,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
  publishCourse,
} from './courseContent.api.js';
import type { CreateLessonInput, CreateModuleInput } from './courseContent.schema.js';

export const modulesKey = (courseId: string) => ['modules', courseId] as const;

export const useModules = (courseId: string) =>
  useQuery({
    queryKey: modulesKey(courseId),
    queryFn: () => fetchModules(courseId),
    enabled: Boolean(courseId),
  });

export const useGenerateStructure = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => generateStructure(courseId, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: modulesKey(courseId) }),
  });
};

export const useCreateModule = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateModuleInput) => createModule(courseId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: modulesKey(courseId) }),
  });
};

export const useUpdateModule = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateModuleInput> }) =>
      updateModule(courseId, id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: modulesKey(courseId) }),
  });
};

export const useDeleteModule = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) => deleteModule(courseId, moduleId),
    onSuccess: () => qc.invalidateQueries({ queryKey: modulesKey(courseId) }),
  });
};

export const useCreateLesson = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, input }: { moduleId: string; input: CreateLessonInput }) =>
      createLesson(courseId, moduleId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: modulesKey(courseId) }),
  });
};

export const useUpdateLesson = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      moduleId,
      lessonId,
      input,
    }: {
      moduleId: string;
      lessonId: string;
      input: Partial<CreateLessonInput>;
    }) => updateLesson(courseId, moduleId, lessonId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: modulesKey(courseId) }),
  });
};

export const useDeleteLesson = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, lessonId }: { moduleId: string; lessonId: string }) =>
      deleteLesson(courseId, moduleId, lessonId),
    onSuccess: () => qc.invalidateQueries({ queryKey: modulesKey(courseId) }),
  });
};

export const usePublishCourse = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (isPublished: boolean) => publishCourse(courseId, isPublished),
    onSuccess: () => qc.invalidateQueries({ queryKey: COURSES_KEY }),
  });
};
