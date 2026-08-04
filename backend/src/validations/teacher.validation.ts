import { z } from 'zod';

export const listCourseStudentsSchema = {
  params: z.object({ courseId: z.uuid() }),
};

export const listSectionStudentsSchema = {
  params: z.object({ sectionId: z.uuid() }),
};

export const createFlagSchema = {
  body: z.object({
    studentId: z.uuid(),
    reason: z.string().min(1, 'Reason is required'),
    courseId: z.uuid().optional(),
    sectionId: z.uuid().optional(),
  }),
};

export const listStudentFlagsSchema = {
  params: z.object({ studentId: z.uuid() }),
};

export const resolveFlagSchema = {
  params: z.object({ id: z.uuid() }),
};
