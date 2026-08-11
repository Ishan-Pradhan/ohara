import { z } from 'zod';

import { api } from '../../lib/axios.js';
import {
  bulkPromoteResultSchema,
  classMembershipSchema,
  electiveCourseSchema,
  enrollmentSchema,
  rosterEntrySchema,
  studentCourseAttendanceSchema,
  studentPlacementSchema,
  type BulkPromoteInput,
  type BulkPromoteResult,
  type ClassMembership,
  type CreateClassMembershipInput,
  type CreateEnrollmentInput,
  type ElectiveCourse,
  type Enrollment,
  type OutcomeInput,
  type RosterEntry,
  type StudentCourseAttendance,
  type StudentPlacement,
  type TransferInput,
} from './placement.schema.js';

export const createClassMembership = async (
  input: CreateClassMembershipInput,
): Promise<ClassMembership> => {
  const res = await api.post('/admin/class-memberships', input);
  return classMembershipSchema.parse(res.data.data);
};

export const fetchClassMemberships = async (studentId: string): Promise<ClassMembership[]> => {
  const res = await api.get('/admin/class-memberships', { params: { studentId } });
  return z.array(classMembershipSchema).parse(res.data.data);
};

export const createEnrollment = async (input: CreateEnrollmentInput): Promise<Enrollment> => {
  const res = await api.post('/admin/enrollments', input);
  return enrollmentSchema.parse(res.data.data);
};

export const transferClassMembership = async (
  membershipId: string,
  input: TransferInput,
): Promise<ClassMembership> => {
  const res = await api.post(`/admin/class-memberships/${membershipId}/transfer`, input);
  return classMembershipSchema.parse(res.data.data);
};

export const setClassMembershipOutcome = async (
  membershipId: string,
  input: OutcomeInput,
): Promise<ClassMembership> => {
  const res = await api.post(`/admin/class-memberships/${membershipId}/outcome`, input);
  return classMembershipSchema.parse(res.data.data);
};

export const fetchStudentPlacement = async (studentId: string): Promise<StudentPlacement> => {
  const res = await api.get(`/students/${studentId}/placement`);
  return studentPlacementSchema.parse(res.data.data);
};

/** Every course in the student's current placement, together — see
 * students.controller.ts's getStudentAttendance for why this exists
 * separately from the per-course GET /courses/:courseId/attendance/me. */
export const fetchStudentAttendance = async (studentId: string): Promise<StudentCourseAttendance[]> => {
  const res = await api.get(`/students/${studentId}/attendance`);
  return z.array(studentCourseAttendanceSchema).parse(res.data.data);
};

// ── BULK PROMOTION ──────────────────────────────────────────────────────────

export const fetchSectionRoster = async (sectionId: string): Promise<RosterEntry[]> => {
  const res = await api.get(`/admin/sections/${sectionId}/roster`);
  return z.array(rosterEntrySchema).parse(res.data.data);
};

export const bulkPromoteSection = async (
  sectionId: string,
  input: BulkPromoteInput,
): Promise<BulkPromoteResult[]> => {
  const res = await api.post(`/admin/sections/${sectionId}/promote`, input);
  return z.array(bulkPromoteResultSchema).parse(res.data.data);
};

// ── ELECTIVES ────────────────────────────────────────────────────────────────

export const fetchStudentElectives = async (studentId: string): Promise<ElectiveCourse[]> => {
  const res = await api.get(`/students/${studentId}/electives`);
  return z.array(electiveCourseSchema).parse(res.data.data);
};

export const enrollInElective = async (courseId: string): Promise<void> => {
  await api.post(`/courses/${courseId}/enroll`);
};

export const dropElective = async (courseId: string): Promise<void> => {
  await api.delete(`/courses/${courseId}/enroll`);
};
