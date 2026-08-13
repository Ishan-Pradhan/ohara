import { z } from 'zod';

import { courseSchema } from '../institution/institution.schema.js';
import { gradebookRowSchema } from '../gradebook/gradebook.schema.js';
import { attendancePercentageSchema } from '../attendance/attendance.schema.js';

/* Mirrors backend/src/validations/teacher.validation.ts and the roster/flag serializers. */

export const teacherCourseSchema = courseSchema.extend({
  classId: z.string().nullable(),
  className: z.string().nullable(),
  programId: z.string().nullable(),
  programName: z.string().nullable(),
  batchName: z.string().nullable(),
  sectionName: z.string().nullable(),
});

export const rosterStudentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.enum(['active', 'inactive', 'graduated', 'archived']),
  avatarUrl: z.string().nullable(),
});

export const createFlagSchema = z
  .object({
    studentId: z.string(),
    reason: z.string().min(1, 'Reason is required'),
    courseId: z.string().optional(),
    sectionId: z.string().optional(),
  })
  .refine((v) => Boolean(v.courseId) || Boolean(v.sectionId), {
    message: 'Missing course or section context',
    path: ['reason'],
  });

export const studentFlagSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  raisedBy: z.string(),
  raisedByName: z.string().nullable(),
  courseId: z.string().nullable(),
  sectionId: z.string().nullable(),
  reason: z.string(),
  status: z.enum(['open', 'resolved']),
  createdAt: z.string(),
});

const sharedCourseRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  code: z.string(),
});

export const myStudentListItemSchema = rosterStudentSchema.extend({
  programId: z.string().nullable(),
  programName: z.string().nullable(),
  className: z.string().nullable(),
  sectionName: z.string().nullable(),
  batchName: z.string().nullable(),
  courses: z.array(sharedCourseRefSchema),
});

export const myStudentCourseSummarySchema = z.object({
  courseId: z.string(),
  courseTitle: z.string(),
  courseCode: z.string(),
  grade: gradebookRowSchema.nullable(),
  attendance: attendancePercentageSchema,
});

export const myStudentProfileSchema = rosterStudentSchema.extend({
  programId: z.string().nullable(),
  programName: z.string().nullable(),
  className: z.string().nullable(),
  sectionName: z.string().nullable(),
  batchName: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  address: z.string().nullable(),
  studentPhone: z.string().nullable(),
  parentName: z.string().nullable(),
  parentPhone: z.string().nullable(),
  previousSchool: z.string().nullable(),
  courses: z.array(myStudentCourseSummarySchema),
  flags: z.array(studentFlagSchema),
});

export const teacherStudentNoteSchema = z.object({
  id: z.string(),
  teacherId: z.string(),
  studentId: z.string(),
  content: z.string(),
  createdAt: z.string(),
});

export type TeacherCourse = z.infer<typeof teacherCourseSchema>;
export type RosterStudent = z.infer<typeof rosterStudentSchema>;
export type CreateFlagInput = z.infer<typeof createFlagSchema>;
export type StudentFlag = z.infer<typeof studentFlagSchema>;
export type MyStudentListItem = z.infer<typeof myStudentListItemSchema>;
export type MyStudentCourseSummary = z.infer<typeof myStudentCourseSummarySchema>;
export type MyStudentProfile = z.infer<typeof myStudentProfileSchema>;
export type TeacherStudentNote = z.infer<typeof teacherStudentNoteSchema>;
