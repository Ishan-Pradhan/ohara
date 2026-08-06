import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };

const base = {
  title: z.string().min(1, 'Title is required'),
  description: z.string().nullable().optional(),
  type: z.enum(['event', 'holiday', 'exam']).default('event'),
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable().optional(),
  allDay: z.boolean().default(false),
};

export const createEventSchema = {
  body: z.discriminatedUnion('audience', [
    z.object({ ...base, audience: z.literal('global') }),
    z.object({
      ...base,
      audience: z.literal('institution_type'),
      institutionType: z.enum(['school', 'college', 'university']),
    }),
    z.object({ ...base, audience: z.literal('program'), programId: z.uuid() }),
    z.object({ ...base, audience: z.literal('class'), classId: z.uuid() }),
  ]),
};

export const listMyEventsSchema = {
  query: z.object({ from: z.iso.datetime().optional(), to: z.iso.datetime().optional() }),
};

export const deleteEventSchema = {
  params: z.object({ id: z.uuid() }),
};

// ── Response schema ─────────────────────────────────────────────────────────

const eventSchema = registry.register(
  'Event',
  z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    type: z.enum(['event', 'holiday', 'exam', 'birthday']),
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime().nullable(),
    allDay: z.boolean(),
    audience: z.enum(['global', 'institution_type', 'program', 'class']),
    institutionType: z.enum(['school', 'college', 'university']).nullable(),
    programId: z.uuid().nullable(),
    classId: z.uuid().nullable(),
    createdBy: z.string(),
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
    403: { description: 'Teachers may only scope events to a class they teach; institution_type/program/global are admin-only' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/events/me',
  tags: ['Events'],
  request: { query: listMyEventsSchema.query },
  responses: {
    200: {
      description: 'Events relevant to the caller in the given range (FR-36), plus every birthday if the caller is an admin',
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
