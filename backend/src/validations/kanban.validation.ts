import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const courseOnly = { description: 'Caller is not an admin, a teacher assigned to this course, or a student enrolled in it' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const createProjectSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({ name: z.string().min(1, 'Name is required') }),
};

export const listProjectsSchema = { params: z.object({ courseId: z.uuid() }) };
export const getProjectSchema = { params: z.object({ courseId: z.uuid(), id: z.uuid() }) };
export const deleteProjectSchema = { params: z.object({ courseId: z.uuid(), id: z.uuid() }) };

export const createColumnSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({ name: z.string().min(1, 'Name is required') }),
};

export const updateColumnSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), columnId: z.uuid() }),
  body: z.object({ name: z.string().min(1, 'Name is required') }),
};

export const deleteColumnSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), columnId: z.uuid() }),
};

export const createTaskSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), columnId: z.uuid() }),
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable().optional(),
    assigneeId: z.uuid().nullable().optional(),
  }),
};

export const updateTaskSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), taskId: z.uuid() }),
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    assigneeId: z.uuid().nullable().optional(),
  }),
};

export const deleteTaskSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), taskId: z.uuid() }),
};

export const moveTaskSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid(), taskId: z.uuid() }),
  body: z.object({ columnId: z.uuid(), orderIndex: z.number().int().min(0) }),
};

// ── Response schemas ─────────────────────────────────────────────────────────

const taskSchema = registry.register(
  'KanbanTask',
  z.object({
    id: z.uuid(),
    columnId: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    assigneeId: z.uuid().nullable(),
    assigneeName: z.string().nullable(),
    orderIndex: z.number(),
  }),
);

const columnSchema = registry.register(
  'BoardColumn',
  z.object({
    id: z.uuid(),
    projectId: z.uuid(),
    name: z.string(),
    orderIndex: z.number(),
    tasks: z.array(taskSchema),
  }),
);

const projectSchema = registry.register(
  'Project',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    name: z.string(),
    createdBy: z.uuid(),
    columns: z.array(columnSchema),
  }),
);

const projectSummarySchema = registry.register(
  'ProjectSummary',
  z.object({ id: z.uuid(), courseId: z.uuid(), name: z.string() }),
);

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/projects',
  tags: ['Projects'],
  request: { params: createProjectSchema.params, body: { content: { 'application/json': { schema: createProjectSchema.body } } } },
  responses: {
    201: { description: 'Project created with the default To do / In progress / Done columns (FR-37)', content: { 'application/json': { schema: envelope(projectSchema) } } },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/projects',
  tags: ['Projects'],
  request: { params: listProjectsSchema.params },
  responses: {
    200: { description: 'Every project for this course', content: { 'application/json': { schema: envelope(z.array(projectSummarySchema)) } } },
    401: unauthenticated,
    403: courseOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/projects/{id}',
  tags: ['Projects'],
  request: { params: getProjectSchema.params },
  responses: {
    200: { description: 'A project with its columns and tasks', content: { 'application/json': { schema: envelope(projectSchema) } } },
    401: unauthenticated,
    403: courseOnly,
    404: { description: 'Project not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/projects/{id}',
  tags: ['Projects'],
  request: { params: deleteProjectSchema.params },
  responses: {
    200: { description: 'Project deleted' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Project not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/projects/{id}/columns',
  tags: ['Projects'],
  request: { params: createColumnSchema.params, body: { content: { 'application/json': { schema: createColumnSchema.body } } } },
  responses: {
    201: { description: 'Column added to the board', content: { 'application/json': { schema: envelope(columnSchema) } } },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Project not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/projects/{id}/columns/{columnId}',
  tags: ['Projects'],
  request: { params: updateColumnSchema.params, body: { content: { 'application/json': { schema: updateColumnSchema.body } } } },
  responses: {
    200: { description: 'Column renamed', content: { 'application/json': { schema: envelope(columnSchema) } } },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Column not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/projects/{id}/columns/{columnId}',
  tags: ['Projects'],
  request: { params: deleteColumnSchema.params },
  responses: {
    200: { description: 'Column deleted, along with its tasks' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Column not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/projects/{id}/columns/{columnId}/tasks',
  tags: ['Projects'],
  request: { params: createTaskSchema.params, body: { content: { 'application/json': { schema: createTaskSchema.body } } } },
  responses: {
    201: { description: 'Task created (FR-38)', content: { 'application/json': { schema: envelope(taskSchema) } } },
    400: { description: 'Assignee is not enrolled in this course' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Column not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/projects/{id}/tasks/{taskId}',
  tags: ['Projects'],
  request: { params: updateTaskSchema.params, body: { content: { 'application/json': { schema: updateTaskSchema.body } } } },
  responses: {
    200: { description: 'Task edited', content: { 'application/json': { schema: envelope(taskSchema) } } },
    400: { description: 'Assignee is not enrolled in this course' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Task not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/projects/{id}/tasks/{taskId}',
  tags: ['Projects'],
  request: { params: deleteTaskSchema.params },
  responses: {
    200: { description: 'Task deleted' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Task not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/projects/{id}/tasks/{taskId}/move',
  tags: ['Projects'],
  request: { params: moveTaskSchema.params, body: { content: { 'application/json': { schema: moveTaskSchema.body } } } },
  responses: {
    200: { description: 'Task moved to a new column/position (FR-39) — the assignee may move their own task; a teacher/admin may move any', content: { 'application/json': { schema: envelope(taskSchema) } } },
    400: { description: 'That column does not belong to this project' },
    401: unauthenticated,
    403: { description: 'Not the assignee, and not a course teacher/admin' },
    404: { description: 'Task not found' },
  },
});
