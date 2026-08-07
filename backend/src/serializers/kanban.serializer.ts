import type { Project } from '../models/projects.model.js';
import type { BoardColumn } from '../models/boardColumns.model.js';
import type { Task } from '../models/tasks.model.js';

export const serializeTask = (task: Task) => ({
  id: task.id,
  columnId: task.columnId,
  title: task.title,
  description: task.description,
  assigneeId: task.assigneeId,
  assigneeName: task.assignee?.name ?? null,
  orderIndex: task.orderIndex,
});

export const serializeColumn = (column: BoardColumn) => ({
  id: column.id,
  projectId: column.projectId,
  name: column.name,
  orderIndex: column.orderIndex,
  tasks: [...(column.tasks ?? [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(serializeTask),
});

const serializeMembers = (project: Project) =>
  (project.members ?? []).map((m) => ({ id: m.studentId, name: m.student?.name ?? 'Unknown student' }));

export const serializeProject = (project: Project) => ({
  id: project.id,
  courseId: project.courseId,
  type: project.type,
  name: project.name,
  createdBy: project.createdBy,
  members: serializeMembers(project),
  columns: [...(project.columns ?? [])]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(serializeColumn),
});

export const serializeProjectSummary = (project: Project) => ({
  id: project.id,
  courseId: project.courseId,
  type: project.type,
  name: project.name,
  members: serializeMembers(project),
});
