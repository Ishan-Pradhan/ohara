import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchProjects,
  fetchProject,
  createProject,
  deleteProject,
  createColumn,
  updateColumn,
  deleteColumn,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
} from './kanban.api.js';
import type { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from './kanban.schema.js';

export const projectsKey = (courseId: string) => ['projects', courseId] as const;
export const projectKey = (courseId: string, id: string) => ['project', courseId, id] as const;

export const useProjects = (courseId: string) =>
  useQuery({ queryKey: projectsKey(courseId), queryFn: () => fetchProjects(courseId), enabled: Boolean(courseId) });

export const useProject = (courseId: string, id: string) =>
  useQuery({
    queryKey: projectKey(courseId, id),
    queryFn: () => fetchProject(courseId, id),
    enabled: Boolean(courseId) && Boolean(id),
  });

export const useCreateProject = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createProject(courseId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey(courseId) }),
  });
};

export const useDeleteProject = (courseId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(courseId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectsKey(courseId) }),
  });
};

const invalidateProject = (qc: ReturnType<typeof useQueryClient>, courseId: string, projectId: string) => {
  void qc.invalidateQueries({ queryKey: projectKey(courseId, projectId) });
};

export const useCreateColumn = (courseId: string, projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createColumn(courseId, projectId, name),
    onSuccess: () => invalidateProject(qc, courseId, projectId),
  });
};

export const useUpdateColumn = (courseId: string, projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, name }: { columnId: string; name: string }) =>
      updateColumn(courseId, projectId, columnId, name),
    onSuccess: () => invalidateProject(qc, courseId, projectId),
  });
};

export const useDeleteColumn = (courseId: string, projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (columnId: string) => deleteColumn(courseId, projectId, columnId),
    onSuccess: () => invalidateProject(qc, courseId, projectId),
  });
};

export const useCreateTask = (courseId: string, projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ columnId, input }: { columnId: string; input: CreateTaskInput }) =>
      createTask(courseId, projectId, columnId, input),
    onSuccess: () => invalidateProject(qc, courseId, projectId),
  });
};

export const useUpdateTask = (courseId: string, projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateTaskInput }) =>
      updateTask(courseId, projectId, taskId, input),
    onSuccess: () => invalidateProject(qc, courseId, projectId),
  });
};

export const useDeleteTask = (courseId: string, projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(courseId, projectId, taskId),
    onSuccess: () => invalidateProject(qc, courseId, projectId),
  });
};

export const useMoveTask = (courseId: string, projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: MoveTaskInput }) =>
      moveTask(courseId, projectId, taskId, input),
    onSuccess: () => invalidateProject(qc, courseId, projectId),
  });
};
