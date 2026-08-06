import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };

const base = {
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  startAt: z.iso.datetime(),
};

export const createEventSchema = {
  body: z.discriminatedUnion('audience', [
    z.object({ ...base, audience: z.literal('global') }),
    z.object({ ...base, audience: z.literal('program'), programId: z.uuid() }),
    z.object({ ...base, audience: z.literal('class'), classId: z.uuid() }),
    z.object({ ...base, audience: z.literal('section'), sectionId: z.uuid() }),
    z.object({ ...base, audience: z.literal('course'), courseId: z.uuid() }),
  ]),
};

export const deleteEventSchema = {
  params: z.object({ id: z.uuid() }),
};

// ── Response schema ─────────────────────────────────────────────────────────

const eventSchema = registry.register(
  'Event',
  z.object({
    id: z.uuid(),
    title: z.string(),
    description: z.string().nullable(),
    startAt: z.iso.datetime(),
    audience: z.enum(['global', 'program', 'class', 'section', 'course']),
    programId: z.uuid().nullable(),
    classId: z.uuid().nullable(),
    sectionId: z.uuid().nullable(),
    courseId: z.uuid().nullable(),
    createdBy: z.uuid(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/events',
  tags: ['Events'],
  request: { body: { content: { 'application/json': { schema: createEventSchema.body } } } },
  responses: {
    201: {
      description: 'Event created (FR-35)',
      content: { 'application/json': { schema: envelope(eventSchema) } },
    },
    401: unauthenticated,
    403: { description: 'Teachers may only scope events to a course they teach or its class; program/section/global scopes are admin-only' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/events/me',
  tags: ['Events'],
  responses: {
    200: {
      description: "Upcoming events relevant to the caller (FR-36): global, plus their program/class/section/course scope",
      content: { 'application/json': { schema: envelope(z.array(eventSchema)) } },
    },
    401: unauthenticated,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/events/{id}',
  tags: ['Events'],
  request: { params: deleteEventSchema.params },
  responses: {
    200: { description: 'Event deleted' },
    401: unauthenticated,
    403: { description: 'Not the creator of this event, and not an admin' },
    404: { description: 'Event not found' },
  },
});
