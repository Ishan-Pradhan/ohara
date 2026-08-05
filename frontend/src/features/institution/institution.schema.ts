import { z } from 'zod';

/* Mirrors backend/src/validations/institution.validation.ts. */

export const institutionTypes = ['school', 'college', 'university'] as const;
export type InstitutionType = (typeof institutionTypes)[number];

export const createProgramSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  institutionType: z.enum(institutionTypes),
  description: z.string().optional(),
  affiliation: z.string().optional(),
});

export const programSchema = z.object({
  id: z.string(),
  name: z.string(),
  institutionType: z.enum(institutionTypes),
  description: z.string().nullable(),
  affiliation: z.string().nullable(),
  createdAt: z.string(),
});

export const createClassSchema = z.object({
  programId: z.string().min(1, 'Choose a program'),
  name: z.string().min(1, 'Name is required'),
  orderIndex: z.number().int('Must be a whole number'),
});

export const classSchema = z.object({
  id: z.string(),
  programId: z.string(),
  name: z.string(),
  orderIndex: z.number(),
  createdAt: z.string(),
});

export const createBatchSchema = z.object({
  programId: z.string().min(1, 'Choose a program'),
  name: z.string().min(1, 'Name is required'),
  startAcademicYearId: z.string().min(1, 'Choose an academic year'),
});

export const batchSchema = z.object({
  id: z.string(),
  programId: z.string(),
  name: z.string(),
  startAcademicYearId: z.string(),
  createdAt: z.string(),
});

export const createAcademicYearSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    isCurrent: z.boolean().optional(),
  })
  .refine((val) => val.endDate > val.startDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

export const academicYearSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  isCurrent: z.boolean(),
  createdAt: z.string(),
});

export const createSectionSchema = z.object({
  classId: z.string().min(1, 'Choose a class'),
  academicYearId: z.string().min(1, 'Choose an academic year'),
  name: z.string().min(1, 'Name is required'),
  classTeacherId: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

export const sectionSchema = z.object({
  id: z.string(),
  classId: z.string(),
  academicYearId: z.string(),
  classTeacherId: z.string().nullable(),
  name: z.string(),
  capacity: z.number().nullable(),
  enrolledCount: z.number(),
  createdAt: z.string(),
});

export const createCourseSchema = z.object({
  classId: z.string().min(1, 'Choose a class'),
  title: z.string().min(1, 'Title is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
  courseType: z.enum(['compulsory', 'elective']).default('compulsory'),
  capacity: z.number().int().positive().optional(),
});

export const courseSchema = z.object({
  id: z.string(),
  classId: z.string(),
  title: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  isPublished: z.boolean(),
  courseType: z.enum(['compulsory', 'elective']),
  capacity: z.number().nullable(),
  enrolledCount: z.number(),
  createdAt: z.string(),
});

export const assignCourseTeacherSchema = z.object({
  teacherId: z.string().min(1, 'Choose a teacher'),
});

export const courseTeacherSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  teacherId: z.string(),
  teacherName: z.string(),
  teacherEmail: z.string(),
  createdAt: z.string(),
});

const domainPattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/;

export const updateInstitutionProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  tagline: z.string().optional(),
  address: z.string().optional(),
  contactEmail: z.string().email('Invalid email').or(z.literal('')).optional(),
  allowedEmailDomain: z
    .string()
    .regex(domainPattern, 'Enter a bare domain, e.g. nccs.edu.np')
    .or(z.literal(''))
    .optional(),
  selfRegistrationEnabled: z.boolean().optional(),
});

export const institutionProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string().nullable(),
  address: z.string().nullable(),
  contactEmail: z.string().nullable(),
  allowedEmailDomain: z.string().nullable(),
  selfRegistrationEnabled: z.boolean(),
  createdAt: z.string(),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type Program = z.infer<typeof programSchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type Class = z.infer<typeof classSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
export type Batch = z.infer<typeof batchSchema>;
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type AcademicYear = z.infer<typeof academicYearSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type Course = z.infer<typeof courseSchema>;
export type AssignCourseTeacherInput = z.infer<typeof assignCourseTeacherSchema>;
export type CourseTeacher = z.infer<typeof courseTeacherSchema>;
export type UpdateInstitutionProfileInput = z.infer<typeof updateInstitutionProfileSchema>;
export type InstitutionProfile = z.infer<typeof institutionProfileSchema>;
