import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

// --- Copilot Conversations ---

export const createCopilotConversationSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const getCopilotConversationsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const getCopilotConversationSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid() }),
};

export const sendCopilotMessageSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid() }),
  body: z.object({
    message: z.string().min(1).max(2000),
  }),
};

export const deleteCopilotConversationSchema = {
  params: z.object({ courseId: z.uuid(), conversationId: z.uuid() }),
};

const copilotMessageSchema = registry.register(
  'CopilotMessage',
  z.object({
    id: z.uuid(),
    seq: z.number(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    createdAt: z.iso.datetime(),
  }),
);

const copilotConversationSchema = registry.register(
  'CopilotConversation',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    title: z.string(),
    status: z.enum(['active', 'closed']),
    createdAt: z.iso.datetime(),
  }),
);

const copilotConversationDetailSchema = registry.register(
  'CopilotConversationDetail',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    title: z.string(),
    status: z.enum(['active', 'closed']),
    messages: z.array(copilotMessageSchema),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/copilot/conversations',
  tags: ['Teacher Copilot'],
  request: { params: getCopilotConversationsSchema.params },
  responses: {
    200: {
      description: 'List of copilot conversations for this teacher in this course',
      content: { 'application/json': { schema: envelope(z.array(copilotConversationSchema)) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/copilot/conversations',
  tags: ['Teacher Copilot'],
  request: { params: createCopilotConversationSchema.params },
  responses: {
    201: {
      description: 'New copilot conversation created',
      content: { 'application/json': { schema: envelope(copilotConversationSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/copilot/conversations/{conversationId}',
  tags: ['Teacher Copilot'],
  request: { params: getCopilotConversationSchema.params },
  responses: {
    200: {
      description: 'Copilot conversation with messages',
      content: { 'application/json': { schema: envelope(copilotConversationDetailSchema) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Conversation not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/copilot/conversations/{conversationId}/messages',
  tags: ['Teacher Copilot'],
  request: {
    params: sendCopilotMessageSchema.params,
    body: { content: { 'application/json': { schema: sendCopilotMessageSchema.body } } },
  },
  responses: {
    200: {
      description: 'User message appended and AI response generated',
      content: {
        'application/json': {
          schema: envelope(z.object({ userMessage: copilotMessageSchema, assistantMessage: copilotMessageSchema })),
        },
      },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Conversation not found' },
  },
});
