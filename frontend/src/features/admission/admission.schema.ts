import { z } from 'zod';

/* Mirrors backend/src/validations/admission.validation.ts. */

export const admitStudentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  sectionId: z.string().min(1, 'Choose a section'),
  batchId: z.string().min(1, 'Choose a batch'),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  previousSchool: z.string().optional(),
  studentPhone: z.string().optional(),
});

export const admittedStudentSchema = z.object({
  student: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  membership: z.object({
    id: z.string(),
    studentId: z.string(),
    sectionId: z.string(),
    academicYearId: z.string(),
  }),
});

export type AdmitStudentInput = z.infer<typeof admitStudentSchema>;
export type AdmittedStudent = z.infer<typeof admittedStudentSchema>;
