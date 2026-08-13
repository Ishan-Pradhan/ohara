import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const adminOnly = { description: 'Caller is not an admin' };

// --- Copilot Conversations ---

export const createCopilotConversationSchema = {};

export const getCopilotConversationsSchema = {};

export const getCopilotConversationSchema = {
  params: z.object({ conversationId: z.uuid() }),
};

export const sendCopilotMessageSchema = {
  params: z.object({ conversationId: z.uuid() }),
  body: z.object({
    message: z.string().min(1).max(2000),
  }),
};

export const deleteCopilotConversationSchema = {
  params: z.object({ conversationId: z.uuid() }),
};

const adminCopilotMessageSchema = registry.register(
  'AdminCopilotMessage',
  z.object({
    id: z.uuid(),
    seq: z.number(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    createdAt: z.iso.datetime(),
  }),
);

const adminCopilotConversationSchema = registry.register(
  'AdminCopilotConversation',
  z.object({
    id: z.uuid(),
    title: z.string(),
    status: z.enum(['active', 'closed']),
    createdAt: z.iso.datetime(),
  }),
);

const adminCopilotConversationDetailSchema = registry.register(
  'AdminCopilotConversationDetail',
  z.object({
    id: z.uuid(),
    title: z.string(),
    status: z.enum(['active', 'closed']),
    messages: z.array(adminCopilotMessageSchema),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/admin/copilot/conversations',
  tags: ['Institution Intelligence'],
  responses: {
    200: {
      description: 'List of this admin\'s copilot conversations',
      content: { 'application/json': { schema: envelope(z.array(adminCopilotConversationSchema)) } },
    },
    401: unauthenticated,
    403: adminOnly,
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/copilot/conversations',
  tags: ['Institution Intelligence'],
  responses: {
    201: {
      description: 'New copilot conversation created',
      content: { 'application/json': { schema: envelope(adminCopilotConversationSchema) } },
    },
    401: unauthenticated,
    403: adminOnly,
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/copilot/conversations/{conversationId}',
  tags: ['Institution Intelligence'],
  request: { params: getCopilotConversationSchema.params },
  responses: {
    200: {
      description: 'Copilot conversation with messages',
      content: { 'application/json': { schema: envelope(adminCopilotConversationDetailSchema) } },
    },
    401: unauthenticated,
    403: adminOnly,
    404: { description: 'Conversation not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/admin/copilot/conversations/{conversationId}/messages',
  tags: ['Institution Intelligence'],
  request: {
    params: sendCopilotMessageSchema.params,
    body: { content: { 'application/json': { schema: sendCopilotMessageSchema.body } } },
  },
  responses: {
    200: {
      description: 'User message appended and AI response generated, grounded in institution-wide data',
      content: {
        'application/json': {
          schema: envelope(z.object({ userMessage: adminCopilotMessageSchema, assistantMessage: adminCopilotMessageSchema })),
        },
      },
    },
    401: unauthenticated,
    403: adminOnly,
    404: { description: 'Conversation not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/copilot/conversations/{conversationId}',
  tags: ['Institution Intelligence'],
  request: { params: deleteCopilotConversationSchema.params },
  responses: {
    200: { description: 'Conversation deleted' },
    401: unauthenticated,
    403: adminOnly,
    404: { description: 'Conversation not found' },
  },
});
