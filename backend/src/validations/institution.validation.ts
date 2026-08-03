import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const forbidden = { description: 'Caller is not an admin' };

// ── PROGRAMS ────────────────────────────────────────────────────────────────

export const createProgramSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    institutionType: z.enum(['school', 'college', 'university']),
    description: z.string().optional(),
  }),
};

export const programSchema = registry.register(
  'Program',
  z.object({
    id: z.uuid(),
    name: z.string(),
    institutionType: z.enum(['school', 'college', 'university']),
    description: z.string().nullable(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/programs',
  tags: ['Institution'],
  request: {
    body: {
      content: { 'application/json': { schema: createProgramSchema.body } },
    },
  },
  responses: {
    201: {
      description: 'Program created',
      content: { 'application/json': { schema: envelope(programSchema) } },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/programs',
  tags: ['Institution'],
  responses: {
    200: {
      description: 'List of programs',
      content: {
        'application/json': { schema: envelope(z.array(programSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

// ── CLASSES ─────────────────────────────────────────────────────────────────

export const createClassSchema = {
  body: z.object({
    programId: z.uuid(),
    name: z.string().min(1, 'Name is required'),
    orderIndex: z.number().int(),
  }),
};

export const listClassesSchema = {
  query: z.object({
    programId: z.uuid().optional(),
  }),
};

export const classSchema = registry.register(
  'Class',
  z.object({
    id: z.uuid(),
    programId: z.uuid(),
    name: z.string(),
    orderIndex: z.number(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/classes',
  tags: ['Institution'],
  request: {
    body: {
      content: { 'application/json': { schema: createClassSchema.body } },
    },
  },
  responses: {
    201: {
      description: 'Class created',
      content: { 'application/json': { schema: envelope(classSchema) } },
    },
    400: { description: 'Validation failed, or (programId, orderIndex) already in use' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Program not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/classes',
  tags: ['Institution'],
  request: { query: listClassesSchema.query },
  responses: {
    200: {
      description: 'List of classes',
      content: {
        'application/json': { schema: envelope(z.array(classSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

// ── ACADEMIC YEARS ──────────────────────────────────────────────────────────

export const createAcademicYearSchema = {
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    isCurrent: z.boolean().optional(),
  }),
};

export const academicYearSchema = registry.register(
  'AcademicYear',
  z.object({
    id: z.uuid(),
    name: z.string(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    isCurrent: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/academic-years',
  tags: ['Institution'],
  request: {
    body: {
      content: {
        'application/json': { schema: createAcademicYearSchema.body },
      },
    },
  },
  responses: {
    201: {
      description:
        'Academic year created. If isCurrent was true, the previous current year is unset',
      content: {
        'application/json': { schema: envelope(academicYearSchema) },
      },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: forbidden,
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/academic-years',
  tags: ['Institution'],
  responses: {
    200: {
      description: 'List of academic years',
      content: {
        'application/json': { schema: envelope(z.array(academicYearSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

// ── SECTIONS ─────────────────────────────────────────────────────────────────

export const createSectionSchema = {
  body: z.object({
    classId: z.uuid(),
    academicYearId: z.uuid(),
    name: z.string().min(1, 'Name is required'),
    classTeacherId: z.uuid().optional(),
  }),
};

export const listSectionsSchema = {
  query: z.object({
    classId: z.uuid().optional(),
    academicYearId: z.uuid().optional(),
  }),
};

export const sectionSchema = registry.register(
  'Section',
  z.object({
    id: z.uuid(),
    classId: z.uuid(),
    academicYearId: z.uuid(),
    classTeacherId: z.uuid().nullable(),
    name: z.string(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/sections',
  tags: ['Institution'],
  request: {
    body: {
      content: { 'application/json': { schema: createSectionSchema.body } },
    },
  },
  responses: {
    201: {
      description: 'Section created',
      content: { 'application/json': { schema: envelope(sectionSchema) } },
    },
    400: {
      description:
        'Validation failed, classTeacherId is not a teacher, or (classId, academicYearId, name) already in use',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Class, academic year, or teacher not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/sections',
  tags: ['Institution'],
  request: { query: listSectionsSchema.query },
  responses: {
    200: {
      description: 'List of sections',
      content: {
        'application/json': { schema: envelope(z.array(sectionSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});
