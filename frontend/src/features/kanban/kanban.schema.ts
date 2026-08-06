import { z } from 'zod';

export const taskSchema = z.object({
  id: z.string(),
  columnId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  orderIndex: z.number(),
});

export const columnSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  orderIndex: z.number(),
  tasks: z.array(taskSchema),
});

export const projectSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  name: z.string(),
  createdBy: z.string(),
  columns: z.array(columnSchema),
});

export const projectSummarySchema = z.object({
  id: z.string(),
  courseId: z.string(),
  name: z.string(),
});

export type Task = z.infer<typeof taskSchema>;
export type Column = z.infer<typeof columnSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  assigneeId?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
}

export interface MoveTaskInput {
  columnId: string;
  orderIndex: number;
}
