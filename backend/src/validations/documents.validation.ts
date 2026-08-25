import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not an admin or a teacher assigned to this course' };
const forbiddenReadOnly = {
  description: 'Caller is not an admin, a teacher assigned to this course, or an enrolled student',
};

export const uploadDocumentSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const listDocumentsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const deleteDocumentSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const getDocumentFileSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
};

export const listViewableDocumentsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const setKnowledgeBaseDocumentSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({ documentId: z.uuid().nullable() }),
};

export const setSyllabusDocumentSchema = {
  params: z.object({ courseId: z.uuid() }),
  body: z.object({ documentId: z.uuid().nullable() }),
};

export const documentSchema = registry.register(
  'Document',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    uploadedBy: z.uuid(),
    filename: z.string(),
    status: z.enum(['processing', 'ready', 'failed']),
    errorMessage: z.string().nullable(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/courses/{courseId}/documents',
  tags: ['Documents'],
  request: {
    params: uploadDocumentSchema.params,
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({ file: z.string().openapi({ type: 'string', format: 'binary' }) }),
        },
      },
    },
  },
  responses: {
    202: {
      description:
        'File accepted — status starts "processing"; extraction/chunking/embedding runs in the background',
      content: { 'application/json': { schema: envelope(documentSchema) } },
    },
    400: { description: 'No file, or not a PDF/Markdown (.md) file' },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/documents',
  tags: ['Documents'],
  request: { params: listDocumentsSchema.params },
  responses: {
    200: {
      description: "A course's uploaded documents, newest first",
      content: { 'application/json': { schema: envelope(z.array(documentSchema)) } },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/courses/{courseId}/documents/{id}',
  tags: ['Documents'],
  request: { params: deleteDocumentSchema.params },
  responses: {
    200: { description: 'Document (and its chunks) deleted, file removed from disk' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Document not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/documents/{id}/file',
  tags: ['Documents'],
  request: { params: getDocumentFileSchema.params },
  responses: {
    200: { description: 'The raw PDF, streamed inline (Content-Disposition: inline)' },
    401: unauthenticated,
    403: forbiddenReadOnly,
    404: { description: 'Document not found, or its file is missing from disk' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/documents/viewable',
  tags: ['Documents'],
  request: { params: listViewableDocumentsSchema.params },
  responses: {
    200: {
      description: 'This course\'s ready documents — student-facing, only once the course is published',
      content: { 'application/json': { schema: envelope(z.array(documentSchema)) } },
    },
    401: unauthenticated,
    403: { description: 'Not an enrolled student' },
    404: { description: 'Course not found, or not yet published' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/knowledge-base',
  tags: ['Documents'],
  request: {
    params: setKnowledgeBaseDocumentSchema.params,
    body: {
      content: { 'application/json': { schema: setKnowledgeBaseDocumentSchema.body } },
    },
  },
  responses: {
    200: { description: 'Course knowledge base document updated (or cleared, with documentId: null)' },
    400: { description: 'Document exists but is not yet fully processed (status must be "ready")' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course or document not found' },
  },
});

registry.registerPath({
  method: 'patch',
  path: '/courses/{courseId}/syllabus',
  tags: ['Documents'],
  request: {
    params: setSyllabusDocumentSchema.params,
    body: {
      content: { 'application/json': { schema: setSyllabusDocumentSchema.body } },
    },
  },
  responses: {
    200: {
      description:
        "Course syllabus document updated (or cleared, with documentId: null) — steers generateStructure's module/lesson breakdown to match this document instead of inventing one",
    },
    400: { description: 'Document exists but is not yet fully processed (status must be "ready")' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course or document not found' },
  },
});
