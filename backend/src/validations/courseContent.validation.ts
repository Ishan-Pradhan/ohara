import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not an admin or a teacher assigned to this course' };

// ── LLM output shape — also the schema the prompt describes ────────────────

export const generatedLessonSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  keyTopics: z.array(z.string()).default([]),
});

export const generatedModuleSchema = z.object({
  title: z.string().min(1),
  lessons: z.array(generatedLessonSchema).min(1),
});

export const generatedCourseStructureSchema = z.object({
  modules: z.array(generatedModuleSchema).min(1),
});

// ── Request schemas ─────────────────────────────────────────────────────────

export const generateStructureSchema = {
  params: z.object({ courseId: z.uuid(), documentId: z.uuid() }),
};

export const listModulesSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const createModuleSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    orderIndex: z.number().int('Must be a whole number'),
  }),
};

export const updateModuleSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
  body: z.object({
    title: z.string().min(1, 'Title is required').optional(),
    orderIndex: z.number().int('Must be a whole number').optional(),
  }),
};

export const deleteModuleSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const createLessonSchema = {
  params: z.object({ courseId: z.uuid(), moduleId: z.uuid() }),
  body: z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.string().min(1, 'Content is required'),
    keyTopics: z.array(z.string()).optional(),
    orderIndex: z.number().int('Must be a whole number'),
  }),
};

export const updateLessonSchema = {
  params: z.object({ courseId: z.uuid(), moduleId: z.uuid(), id: z.uuid() }),
  body: z.object({
    title: z.string().min(1, 'Title is required').optional(),
    content: z.string().min(1, 'Content is required').optional(),
    keyTopics: z.array(z.string()).optional(),
    orderIndex: z.number().int('Must be a whole number').optional(),
  }),
};

export const deleteLessonSchema = {
  params: z.object({ courseId: z.uuid(), moduleId: z.uuid(), id: z.uuid() }),
};

export const publishCourseSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({ isPublished: z.boolean() }),
};

// ── Response schemas ─────────────────────────────────────────────────────────

export const lessonSchema = registry.register(
  'Lesson',
  z.object({
    id: z.uuid(),
    moduleId: z.uuid(),
    title: z.string(),
    content: z.string(),
    keyTopics: z.array(z.string()),
    orderIndex: z.number(),
    createdAt: z.iso.datetime(),
  }),
);

export const moduleSchema = registry.register(
  'Module',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    title: z.string(),
    orderIndex: z.number(),
    createdAt: z.iso.datetime(),
    lessons: z.array(lessonSchema),
  }),
);

// ── OpenAPI path registrations ───────────────────────────────────────────────

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/documents/{documentId}/generate',
  tags: ['Course Content'],
  request: { params: generateStructureSchema.params },
  responses: {
    201: {
      description: 'Draft modules/lessons generated and appended to the course',
      content: { 'application/json': { schema: envelope(z.array(moduleSchema)) } },
    },
    400: { description: 'Document does not belong to this course, or is not yet ready' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Document not found' },
    502: { description: 'The LLM could not produce a valid structure after a retry' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/modules',
  tags: ['Course Content'],
  request: { params: listModulesSchema.params },
  responses: {
    200: {
      description: "A course's modules (with nested lessons), in order",
      content: { 'application/json': { schema: envelope(z.array(moduleSchema)) } },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/modules',
  tags: ['Course Content'],
  request: {
    params: createModuleSchema.params,
    body: { content: { 'application/json': { schema: createModuleSchema.body } } },
  },
  responses: {
    201: {
      description: 'Module created',
      content: { 'application/json': { schema: envelope(moduleSchema) } },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/modules/{id}',
  tags: ['Course Content'],
  request: {
    params: updateModuleSchema.params,
    body: { content: { 'application/json': { schema: updateModuleSchema.body } } },
  },
  responses: {
    200: {
      description: 'Module updated',
      content: { 'application/json': { schema: envelope(moduleSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Module not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/modules/{id}',
  tags: ['Course Content'],
  request: { params: deleteModuleSchema.params },
  responses: {
    200: { description: 'Module (and its lessons) deleted' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Module not found' },
  },
});

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/modules/{moduleId}/lessons',
  tags: ['Course Content'],
  request: {
    params: createLessonSchema.params,
    body: { content: { 'application/json': { schema: createLessonSchema.body } } },
  },
  responses: {
    201: {
      description: 'Lesson created',
      content: { 'application/json': { schema: envelope(lessonSchema) } },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Module not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/modules/{moduleId}/lessons/{id}',
  tags: ['Course Content'],
  request: {
    params: updateLessonSchema.params,
    body: { content: { 'application/json': { schema: updateLessonSchema.body } } },
  },
  responses: {
    200: {
      description: 'Lesson updated',
      content: { 'application/json': { schema: envelope(lessonSchema) } },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Lesson not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/modules/{moduleId}/lessons/{id}',
  tags: ['Course Content'],
  request: { params: deleteLessonSchema.params },
  responses: {
    200: { description: 'Lesson deleted' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Lesson not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/publish',
  tags: ['Course Content'],
  request: {
    params: publishCourseSchema.params,
    body: { content: { 'application/json': { schema: publishCourseSchema.body } } },
  },
  responses: {
    200: { description: 'Course publish state updated' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course not found' },
  },
});
