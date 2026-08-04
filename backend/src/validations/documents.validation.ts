import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not an admin or a teacher assigned to this course' };

export const uploadDocumentSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const listDocumentsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const deleteDocumentSchema = {
  params: z.object({ courseId: z.uuid(), id: z.uuid() }),
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
        'PDF accepted — status starts "processing"; extraction/chunking/embedding runs in the background',
      content: { 'application/json': { schema: envelope(documentSchema) } },
    },
    400: { description: 'No file, or not a PDF' },
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
