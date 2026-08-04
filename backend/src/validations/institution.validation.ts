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
    affiliation: z.string().optional(),
  }),
};

export const programSchema = registry.register(
  'Program',
  z.object({
    id: z.uuid(),
    name: z.string(),
    institutionType: z.enum(['school', 'college', 'university']),
    description: z.string().nullable(),
    affiliation: z.string().nullable(),
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

const idParams = { params: z.object({ id: z.uuid() }) };

export const updateProgramSchema = {
  params: idParams.params,
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    institutionType: z.enum(['school', 'college', 'university']).optional(),
    description: z.string().optional(),
    affiliation: z.string().optional(),
  }),
};

export const deleteProgramSchema = idParams;

registry.registerPath({
  method: 'patch',
  path: '/admin/programs/{id}',
  tags: ['Institution'],
  request: {
    params: updateProgramSchema.params,
    body: {
      content: { 'application/json': { schema: updateProgramSchema.body } },
    },
  },
  responses: {
    200: {
      description: 'Program updated',
      content: { 'application/json': { schema: envelope(programSchema) } },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Program not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/programs/{id}',
  tags: ['Institution'],
  request: { params: deleteProgramSchema.params },
  responses: {
    200: { description: 'Program deleted' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Program not found' },
    409: { description: 'Program still has classes — cannot delete' },
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

export const updateClassSchema = {
  params: idParams.params,
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    orderIndex: z.number().int().optional(),
  }),
};

export const deleteClassSchema = idParams;

registry.registerPath({
  method: 'patch',
  path: '/admin/classes/{id}',
  tags: ['Institution'],
  request: {
    params: updateClassSchema.params,
    body: {
      content: { 'application/json': { schema: updateClassSchema.body } },
    },
  },
  responses: {
    200: {
      description: 'Class updated',
      content: { 'application/json': { schema: envelope(classSchema) } },
    },
    400: { description: 'Validation failed, or (programId, orderIndex) already in use' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Class not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/classes/{id}',
  tags: ['Institution'],
  request: { params: deleteClassSchema.params },
  responses: {
    200: { description: 'Class deleted' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Class not found' },
    409: { description: 'Class still has sections or courses — cannot delete' },
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

export const updateAcademicYearSchema = {
  params: idParams.params,
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    isCurrent: z.boolean().optional(),
  }),
};

export const deleteAcademicYearSchema = idParams;

registry.registerPath({
  method: 'patch',
  path: '/admin/academic-years/{id}',
  tags: ['Institution'],
  request: {
    params: updateAcademicYearSchema.params,
    body: {
      content: { 'application/json': { schema: updateAcademicYearSchema.body } },
    },
  },
  responses: {
    200: {
      description:
        'Academic year updated. If isCurrent was set to true, the previous current year is unset',
      content: { 'application/json': { schema: envelope(academicYearSchema) } },
    },
    400: { description: 'Validation failed' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Academic year not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/academic-years/{id}',
  tags: ['Institution'],
  request: { params: deleteAcademicYearSchema.params },
  responses: {
    200: { description: 'Academic year deleted' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Academic year not found' },
    409: {
      description:
        'Academic year still has sections, placements, or enrollments — cannot delete',
    },
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

export const updateSectionSchema = {
  params: idParams.params,
  body: z.object({
    name: z.string().min(1, 'Name is required').optional(),
    classTeacherId: z.uuid().nullable().optional(),
  }),
};

export const deleteSectionSchema = idParams;

registry.registerPath({
  method: 'patch',
  path: '/admin/sections/{id}',
  tags: ['Institution'],
  request: {
    params: updateSectionSchema.params,
    body: {
      content: { 'application/json': { schema: updateSectionSchema.body } },
    },
  },
  responses: {
    200: {
      description: 'Section updated',
      content: { 'application/json': { schema: envelope(sectionSchema) } },
    },
    400: {
      description:
        'Validation failed, classTeacherId is not a teacher, or (classId, academicYearId, name) already in use',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Section or teacher not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/sections/{id}',
  tags: ['Institution'],
  request: { params: deleteSectionSchema.params },
  responses: {
    200: { description: 'Section deleted' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Section not found' },
    409: { description: 'Section still has students placed in it — cannot delete' },
  },
});

// ── COURSES ──────────────────────────────────────────────────────────────────

export const createCourseSchema = {
  body: z.object({
    classId: z.uuid(),
    title: z.string().min(1, 'Title is required'),
    code: z.string().min(1, 'Code is required'),
    description: z.string().optional(),
  }),
};

export const listCoursesSchema = {
  query: z.object({
    classId: z.uuid().optional(),
  }),
};

export const courseSchema = registry.register(
  'Course',
  z.object({
    id: z.uuid(),
    classId: z.uuid(),
    title: z.string(),
    code: z.string(),
    description: z.string().nullable(),
    isPublished: z.boolean(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/courses',
  tags: ['Institution'],
  request: {
    body: {
      content: { 'application/json': { schema: createCourseSchema.body } },
    },
  },
  responses: {
    201: {
      description: 'Course created',
      content: { 'application/json': { schema: envelope(courseSchema) } },
    },
    400: { description: 'Validation failed, or code already in use' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Class not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/courses',
  tags: ['Institution'],
  request: { query: listCoursesSchema.query },
  responses: {
    200: {
      description: 'List of courses',
      content: {
        'application/json': { schema: envelope(z.array(courseSchema)) },
      },
    },
    401: unauthenticated,
    403: forbidden,
  },
});

export const updateCourseSchema = {
  params: idParams.params,
  body: z.object({
    title: z.string().min(1, 'Title is required').optional(),
    code: z.string().min(1, 'Code is required').optional(),
    description: z.string().optional(),
  }),
};

export const deleteCourseSchema = idParams;

registry.registerPath({
  method: 'patch',
  path: '/admin/courses/{id}',
  tags: ['Institution'],
  request: {
    params: updateCourseSchema.params,
    body: {
      content: { 'application/json': { schema: updateCourseSchema.body } },
    },
  },
  responses: {
    200: {
      description: 'Course updated',
      content: { 'application/json': { schema: envelope(courseSchema) } },
    },
    400: { description: 'Validation failed, or code already in use' },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course not found' },
  },
});

registry.registerPath({
  method: 'delete',
  path: '/admin/courses/{id}',
  tags: ['Institution'],
  request: { params: deleteCourseSchema.params },
  responses: {
    200: {
      description: 'Course deleted — its teacher assignments and enrollments are removed too',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course not found' },
  },
});

// ── COURSE TEACHERS ──────────────────────────────────────────────────────────

const courseIdParams = { params: z.object({ courseId: z.uuid() }) };

export const assignCourseTeacherSchema = {
  params: courseIdParams.params,
  body: z.object({ teacherId: z.uuid() }),
};

export const listCourseTeachersSchema = courseIdParams;

export const courseTeacherSchema = registry.register(
  'CourseTeacher',
  z.object({
    id: z.uuid(),
    courseId: z.uuid(),
    teacherId: z.uuid(),
    teacherName: z.string(),
    teacherEmail: z.string(),
    createdAt: z.iso.datetime(),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/admin/courses/{courseId}/teachers',
  tags: ['Institution'],
  request: {
    params: assignCourseTeacherSchema.params,
    body: {
      content: { 'application/json': { schema: assignCourseTeacherSchema.body } },
    },
  },
  responses: {
    201: {
      description: 'Teacher assigned to the course',
      content: {
        'application/json': { schema: envelope(courseTeacherSchema) },
      },
    },
    400: {
      description: 'teacherId is not a teacher, or already assigned to this course',
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course or teacher not found' },
  },
});

registry.registerPath({
  method: 'get',
  path: '/admin/courses/{courseId}/teachers',
  tags: ['Institution'],
  request: { params: listCourseTeachersSchema.params },
  responses: {
    200: {
      description: 'Teachers assigned to the course',
      content: {
        'application/json': {
          schema: envelope(z.array(courseTeacherSchema)),
        },
      },
    },
    401: unauthenticated,
    403: forbidden,
    404: { description: 'Course not found' },
  },
});
