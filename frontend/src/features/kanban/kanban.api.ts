import { z } from 'zod';
import { api } from '../../lib/axios.js';
import {
  projectSchema,
  projectSummarySchema,
  columnSchema,
  taskSchema,
  type Project,
  type ProjectSummary,
  type Column,
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
  type MoveTaskInput,
} from './kanban.schema.js';

export const fetchProjects = async (courseId: string): Promise<ProjectSummary[]> => {
  const res = await api.get(`/courses/${courseId}/projects`);
  return z.array(projectSummarySchema).parse(res.data.data);
};

export const fetchProject = async (courseId: string, id: string): Promise<Project> => {
  const res = await api.get(`/courses/${courseId}/projects/${id}`);
  return projectSchema.parse(res.data.data);
};

export const createProject = async (courseId: string, name: string): Promise<Project> => {
  const res = await api.post(`/courses/${courseId}/projects`, { name });
  return projectSchema.parse(res.data.data);
};

export const deleteProject = async (courseId: string, id: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/projects/${id}`);
};

export const createColumn = async (courseId: string, projectId: string, name: string): Promise<Column> => {
  const res = await api.post(`/courses/${courseId}/projects/${projectId}/columns`, { name });
  return columnSchema.parse(res.data.data);
};

export const updateColumn = async (
  courseId: string,
  projectId: string,
  columnId: string,
  name: string,
): Promise<Column> => {
  const res = await api.patch(`/courses/${courseId}/projects/${projectId}/columns/${columnId}`, { name });
  return columnSchema.parse(res.data.data);
};

export const deleteColumn = async (courseId: string, projectId: string, columnId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/projects/${projectId}/columns/${columnId}`);
};

export const createTask = async (
  courseId: string,
  projectId: string,
  columnId: string,
  input: CreateTaskInput,
): Promise<Task> => {
  const res = await api.post(
    `/courses/${courseId}/projects/${projectId}/columns/${columnId}/tasks`,
    input,
  );
  return taskSchema.parse(res.data.data);
};

export const updateTask = async (
  courseId: string,
  projectId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<Task> => {
  const res = await api.patch(`/courses/${courseId}/projects/${projectId}/tasks/${taskId}`, input);
  return taskSchema.parse(res.data.data);
};

export const deleteTask = async (courseId: string, projectId: string, taskId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/projects/${projectId}/tasks/${taskId}`);
};

export const moveTask = async (
  courseId: string,
  projectId: string,
  taskId: string,
  input: MoveTaskInput,
): Promise<Task> => {
  const res = await api.patch(`/courses/${courseId}/projects/${projectId}/tasks/${taskId}/move`, input);
  return taskSchema.parse(res.data.data);
};
