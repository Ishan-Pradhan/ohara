import { registry, z } from './registry.js';
import { envelope } from './user.response.js';

const unauthenticated = { description: 'Not authenticated' };
const teacherOnly = { description: 'Caller is not an admin or a teacher assigned to this course' };

const examMarkInputSchema = z.object({
  studentId: z.uuid(),
  marksObtained: z.number().min(0),
  maxMarks: z.number().positive(),
});

export const getCourseExamMarksSchema = {
  params: z.object({ courseId: z.uuid(), examTermId: z.uuid() }),
};

export const upsertCourseExamMarksSchema = {
  params: z.object({ courseId: z.uuid(), examTermId: z.uuid() }),
  body: z.object({ marks: z.array(examMarkInputSchema).min(1) }),
};

const courseExamMarkRowSchema = registry.register(
  'CourseExamMarkRow',
  z.object({
    studentId: z.uuid(),
    studentName: z.string(),
    marksObtained: z.number().nullable(),
    maxMarks: z.number().nullable(),
  }),
);

registry.registerPath({
  method: 'get',
  path: '/courses/{courseId}/exam-marks/{examTermId}',
  tags: ['Exam Marks'],
  request: { params: getCourseExamMarksSchema.params },
  responses: {
    200: {
      description: 'Every roster student for this course with their marks for this exam term, if already entered',
      content: { 'application/json': { schema: envelope(z.array(courseExamMarkRowSchema)) } },
    },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Exam term not found' },
  },
});

registry.registerPath({
  method: 'put',
  path: '/courses/{courseId}/exam-marks/{examTermId}',
  tags: ['Exam Marks'],
  request: {
    params: upsertCourseExamMarksSchema.params,
    body: { content: { 'application/json': { schema: upsertCourseExamMarksSchema.body } } },
  },
  responses: {
    200: {
      description: "Marks saved for this course + exam term — teacher-entered, feeds the student's report card",
      content: { 'application/json': { schema: envelope(z.array(courseExamMarkRowSchema)) } },
    },
    400: { description: 'A mark references a student not enrolled in this course' },
    401: unauthenticated,
    403: teacherOnly,
    404: { description: 'Exam term not found' },
  },
});
