import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const studentOnly = { description: 'Caller is not a student' };

export const createMyTaskSchema = {
  params: z.object({ columnId: z.uuid() }),
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().nullable().optional(),
  }),
};

export const updateMyTaskSchema = {
  params: z.object({ taskId: z.uuid() }),
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  }),
};

export const deleteMyTaskSchema = { params: z.object({ taskId: z.uuid() }) };

export const moveMyTaskSchema = {
  params: z.object({ taskId: z.uuid() }),
  body: z.object({ columnId: z.uuid(), orderIndex: z.number().int().min(0) }),
};

const taskSchema = registry.register(
  'PersonalKanbanTask',
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
  'PersonalBoardColumn',
  z.object({
    id: z.uuid(),
    projectId: z.uuid(),
    name: z.string(),
    orderIndex: z.number(),
    tasks: z.array(taskSchema),
  }),
);

const boardSchema = registry.register(
  'PersonalBoard',
  z.object({
    id: z.uuid(),
    courseId: z.uuid().nullable(),
    type: z.enum(['course', 'personal']),
    name: z.string(),
    createdBy: z.uuid(),
    members: z.array(z.object({ id: z.uuid(), name: z.string() })),
    columns: z.array(columnSchema),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/me/kanban/board',
  tags: ['Personal Kanban'],
  responses: {
    200: { description: 'Your private, non-course Kanban board — created on first visit if it does not exist yet', content: { 'application/json': { schema: envelope(boardSchema) } } },
    201: { description: 'Your board, created for the first time', content: { 'application/json': { schema: envelope(boardSchema) } } },
    401: unauthenticated,
    403: studentOnly,
  },
});

registry.registerPath({
  method: 'post',
  path: '/me/kanban/columns/{columnId}/tasks',
  tags: ['Personal Kanban'],
  request: { params: createMyTaskSchema.params, body: { content: { 'application/json': { schema: createMyTaskSchema.body } } } },
  responses: {
    201: { description: 'Personal task created', content: { 'application/json': { schema: envelope(taskSchema) } } },
    401: unauthenticated,
    403: studentOnly,
    404: { description: 'Column not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/me/kanban/tasks/{taskId}',
  tags: ['Personal Kanban'],
  request: { params: updateMyTaskSchema.params, body: { content: { 'application/json': { schema: updateMyTaskSchema.body } } } },
  responses: {
    200: { description: 'Personal task edited', content: { 'application/json': { schema: envelope(taskSchema) } } },
    401: unauthenticated,
    403: studentOnly,
    404: { description: 'Task not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/me/kanban/tasks/{taskId}',
  tags: ['Personal Kanban'],
  request: { params: deleteMyTaskSchema.params },
  responses: {
    200: { description: 'Personal task deleted' },
    401: unauthenticated,
    403: studentOnly,
    404: { description: 'Task not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/me/kanban/tasks/{taskId}/move',
  tags: ['Personal Kanban'],
  request: { params: moveMyTaskSchema.params, body: { content: { 'application/json': { schema: moveMyTaskSchema.body } } } },
  responses: {
    200: { description: 'Personal task moved to a new column/position', content: { 'application/json': { schema: envelope(taskSchema) } } },
    400: { description: 'That column does not belong to your board' },
    401: unauthenticated,
    403: studentOnly,
    404: { description: 'Task not found' },
  },
});
