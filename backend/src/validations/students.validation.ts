import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

export const getStudentPlacementSchema = {
  params: z.object({ studentId: z.uuid() }),
};

const placementResponseSchema = registry.register(
  'StudentPlacement',
  z.object({
    studentId: z.uuid(),
    program: z
      .object({
        id: z.uuid(),
        name: z.string(),
        institutionType: z.string(),
        affiliation: z.string().nullable(),
      })
      .nullable(),
    class: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    section: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    academicYear: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    courses: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        code: z.string(),
        teachers: z.array(z.object({ id: z.uuid(), name: z.string() })),
      }),
    ),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/students/{studentId}/placement',
  tags: ['Placement'],
  request: { params: getStudentPlacementSchema.params },
  responses: {
    200: {
      description:
        "The student's current program/class/section/courses and who teaches them",
      content: { 'application/json': { schema: envelope(placementResponseSchema) } },
    },
    401: { description: 'Not authenticated' },
    403: { description: "Not authorized to view this student's placement" },
    404: {
      description:
        'Student not found, no current academic year set, or student not placed for the current year',
    },
  },
});
