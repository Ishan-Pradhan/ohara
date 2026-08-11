import { z } from 'zod';

export const studentProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  parentName: z.string().nullable(),
  parentPhone: z.string().nullable(),
  address: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  previousSchool: z.string().nullable(),
  studentPhone: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updateStudentProfileSchema = z.object({
  parentName: z.string().min(1).nullable().optional(),
  parentPhone: z.string().min(1).nullable().optional(),
  address: z.string().min(1).nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  previousSchool: z.string().min(1).nullable().optional(),
  studentPhone: z.string().min(1).nullable().optional(),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;
export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;
